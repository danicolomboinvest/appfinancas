"use server";

import { revalidatePath } from "next/cache";
import { installmentCanonical, installmentDescription, parseInstallment } from "@/lib/entries/recurrence";
import { countMoneyLines, detectInvoiceTotal, looksLikeCardInvoice, MOTIVO_SINAIS_FATURA, sinaisDesmentemExtrato, type DocKind } from "@/lib/import/detect";
import { profileDocument } from "@/lib/import/profile";
import { checarPlausibilidade, type Suspeita } from "@/lib/import/plausibility";
import { isPartialRead, mensagemImplausivel, recordImportDiagnostic, safeHeader } from "@/lib/repositories/import-diagnostic.repo";
import { storeFailedImportFile } from "@/lib/repositories/import-file.repo";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import {
  createImportBatch,
  deleteEmptyImportBatch,
  deleteImportBatchWithEntries,
} from "@/lib/repositories/import-batch.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatement } from "@/lib/import/statement-parser";
import { isFaturaSummaryLine, comprasDaFaturaSaoPositivas, pareceCreditoDePagamento } from "@/lib/import/fatura-lines";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { pdfTextQuality } from "@/lib/import/pdf-quality";
import { classify, normalizeMerchant, type LearnedRule } from "@/lib/import/classify";
import { pareceEstorno } from "@/lib/import/estorno";
import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "@/lib/import/dinheiro-proprio";

const PARENT_CATEGORY_VALUES: ParentCategory[] = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "IMPOSTOS",
  "OUTROS",
];

/** O tipo do lançamento. O parser só decide entre Renda e Gasto pelo sinal — Aporte é sempre
 * escolha manual na revisão (um Pix pra você mesma cai como gasto/renda pelo sinal, e só você
 * sabe que era pra investimento). */
export type EntryType = "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";

export type ReviewItem = {
  /** Chave estável no cliente (índice na lista original). */
  key: number;
  date: string;
  description: string;
  /** Sempre positivo aqui; o sinal virou `category`. */
  amount: number;
  category: EntryType;
  parentCategory: ParentCategory | null;
  /** Categoria personalizada escolhida/criada na revisão (alternativa às 7 categorias-mãe fixas). */
  customCategoryId: string | null;
  subcategory: string | null;
  /** true = classificado automaticamente; false = precisa de revisão manual (categoria vazia). */
  autoClassified: boolean;
  /** Compra parcelada ("03/10" na fatura): as parcelas seguintes entram sozinhas nos meses seguintes. */
  installment: { current: number; total: number; confident: boolean } | null;
  /** Mesma data, valor e descrição repetidos DENTRO do arquivo: chave do grupo e quantas vezes. */
  fileRepeat: { key: string; total: number } | null;
  /** Perfil de destino escolhido na revisão (compra da Empresa que caiu no cartão Pessoal, por
   * exemplo). `null` = o perfil ativo de sempre, o padrão pra toda a importação. */
  profileId: string | null;
  /**
   * Estorno: dinheiro de uma compra voltando ("ESTORNO", crédito na fatura). Não é renda: é gasto
   * que deixou de existir. Vai como gasto NEGATIVO na categoria da compra, e a compra e o estorno
   * se anulam em todas as somas.
   */
  estorno?: boolean;
  /** Parece com um lançamento que a pessoa já fez à mão (mesmo valor, data perto): a tela pergunta. */
  possivelDuplicata?: { descricao: string; data: string | null } | null;
  /** Fica de fora da importação (pagamento de fatura de quem importa a fatura, "só mudei de conta"). */
  ignorar?: boolean;
  /** Por que o app tratou a linha diferente ("Aplicação: entra como guardado"). */
  nota?: string | null;
  /** Dinheiro que pode ser dela mesma: a tela pergunta antes de importar. */
  duvida?: "conta_propria" | "resgate" | null;
};

/** O que o app entendeu do arquivo, pra pessoa conferir antes de gravar. */
export type ParseStats = {
  /** O que o arquivo parece ser, pelo conteúdo/nome; "unknown" quando não dá pra saber. */
  detectedKind: DocKind;
  detectedReason: string;
  /** O que o app entendeu lendo o arquivo inteiro: "Extrato bancário · Nubank · 01/05 a 14/09/2026". */
  summary: string;
  /** Linhas do arquivo com cara de valor × lançamentos lidos. */
  moneyLines: number;
  parsed: number;
  /** Fatura: total impresso no arquivo, se achado, pra bater com a soma. */
  invoiceTotal: number | null;
  sumExpense: number;
  sumIncome: number;
  /** Sinais de que o app leu o arquivo errado. Vazio = nada estranho. */
  suspeitas: Suspeita[];
};

export type ParseStatementResult =
  | { ok: true; items: ReviewItem[]; customCategories: { id: string; name: string }[]; stats: ParseStats }
  | { ok: false; error: string; needsPassword?: boolean };

/** Lê o extrato (CSV/OFX/Excel/PDF), classifica cada transação e devolve a fila pra revisão.
 * O arquivo vem CRU num FormData ({ file, encoding }), string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
export async function parseStatementAction(formData: FormData): Promise<ParseStatementResult> {
  const ctx = await getRequiredSession();
  const encoding = String(formData.get("encoding") ?? "text");
  // "fatura" = fatura de cartão (tudo é gasto); "extrato" = extrato bancário (sinal manda).
  const docType = String(formData.get("docType") ?? "extrato");

  const uploaded = formData.get("file");
  const uploadedName = uploaded instanceof File ? uploaded.name : null;
  /** Toda saída em erro passa por aqui: é o que deixa rastro pra checagem diária. */
  const falha = async (message: string, extra: Partial<Parameters<typeof recordImportDiagnostic>[0]> = {}) => {
    const diagnosticId = await recordImportDiagnostic({
      userId: ctx.userId,
      target: docType,
      stage: "parse",
      ok: false,
      fileName: uploadedName,
      encoding,
      message,
      ...extra,
    });
    // Guarda o arquivo que não deu certo: sem ele, descobrir o formato de um banco novo depende
    // de a pessoa responder no WhatsApp, e quem desiste calado nunca responde.
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "falha" });
  };

  let text: string;
  let source: "auto" | "pdf";
  try {
    ({ text, source } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof PasswordRequiredError) return { ok: false, error: err.message, needsPassword: true };
    if (err instanceof UploadReadError) {
      // A pessoa vê a frase limpa; o diagnóstico guarda também a causa técnica.
      await falha(err.detail ? `${err.message} [${err.detail}]` : err.message);
      return { ok: false, error: err.message };
    }
    console.error("parseStatementAction: leitura falhou", {
      name: uploadedName ?? "?",
      size: uploaded instanceof Blob ? uploaded.size : 0,
      encoding,
      err,
    });
    const msg = "Não consegui abrir esse arquivo. Tente exportar de novo em Excel (.xlsx), CSV ou OFX.";
    await falha(`${msg} [${err instanceof Error ? err.message.slice(0, 120) : "erro desconhecido"}]`);
    return { ok: false, error: msg };
  }

  // PDF escaneado/foto não tem texto extraível; PDF "impresso" pelo celular tem só os números.
  const quality = encoding === "pdf" ? pdfTextQuality(text) : "ok";
  if (quality === "empty") {
    const msg =
      "Não consegui ler este PDF, ele parece ser escaneado ou uma foto. Exporte o extrato em Excel (.xlsx), CSV ou OFX que aí funciona.";
    await falha(msg, { kind: "pdf-vazio" });
    return { ok: false, error: msg };
  }
  if (quality === "numbers-only") {
    const msg =
      "Esse PDF veio da impressão pelo celular: os números estão lá, mas as descrições viraram desenho. Exporte o extrato em Excel (.xlsx), CSV ou OFX pelo app do banco, ou baixe o PDF original pelo computador.";
    await falha(msg, { kind: "pdf-so-numeros" });
    return { ok: false, error: msg };
  }

  // Lê o arquivo INTEIRO e monta o perfil (banco, período, o que tem dentro) antes de decidir.
  const fileMeta = formData.get("file");
  const fileName = fileMeta instanceof File ? fileMeta.name : null;
  const profile = profileDocument(text, fileName);
  if (profile.kind === "position" && !profile.contents.includes("movements")) {
    const msg = `Li o arquivo inteiro: ${profile.summary}. É a posição dos investimentos, não entradas e saídas: suba em Carteira › Importar.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }
  if (profile.kind === "irpf") {
    const msg = `Li o arquivo inteiro: ${profile.summary}. A declaração serve pra pegar o preço médio dos ativos: use Carteira › Preço médio (IR).`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }

  const faturaYear = Number(String(formData.get("faturaMonth") ?? "").slice(0, 4)) || undefined;
  const parsedRaw = parseStatement(text, source, faturaYear);
  // Fatura: linhas de RESUMO ("pagamento efetuado", "total de compras", "total de crédito
  // recebido") são agregados que a própria fatura já detalha em outras linhas — não são uma
  // compra a mais. Sem isso, o "pagamento de fatura" virava um gasto extra na revisão.
  const parsed = docType === "fatura" ? parsedRaw.filter((txn) => !isFaturaSummaryLine(txn)) : parsedRaw;
  const moneyLines = countMoneyLines(text);
  if (parsed.length === 0) {
    // Diagnóstico pro suporte: perfil + cabeçalho (sem valores), pra reconhecer o formato do banco.
    const header = text.split(/\r?\n/).find((l) => l.trim())?.slice(0, 200) ?? "";
    console.error("parseStatementAction: zero lançamentos", { fileName, encoding, docType, kind: profile.kind, institution: profile.institution, moneyLines, chars: text.length, header });
    const msg =
      moneyLines > 3
        ? `Li o arquivo inteiro (${profile.summary}) e vi ${moneyLines} linhas com valor, mas não consegui ler nenhuma como lançamento. Esse formato eu ainda não conheço: manda o arquivo pro suporte que a gente ensina o app.`
        : `Li o arquivo inteiro (${profile.summary}) e não encontrei transações. Se for um PDF escaneado/foto, exporte em Excel (.xlsx) ou CSV, costuma ler melhor.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, moneyLines, header: safeHeader(text) });
    return { ok: false, error: msg };
  }
  // Fatura subida como extrato (ou o contrário) é o erro mais caro: compra vira renda. O perfil
  // do arquivo inteiro e, na dúvida, os sinais dizem o que ele é; a tela avisa antes de gravar.
  let detectedKind: DocKind = profile.kind === "invoice" ? "fatura" : profile.kind === "statement" || profile.kind === "position" ? "extrato" : "unknown";
  // A FORMA dos dados vale mais que as palavras do arquivo. Extrato bancário tem entrada e
  // saída; quando todo lançamento vem com o mesmo sinal, é fatura de cartão quase sempre — e
  // fatura costuma trazer "extrato" escrito no cabeçalho, o que fazia o perfil dizer "statement"
  // e esta checagem nem rodar. Foi assim que duas pessoas lançaram a fatura inteira como RENDA:
  // R$ 5.528 de compras no MercadoLivre e na Apple viraram receita do mês, sem nenhum aviso.
  // Mas só desmente o perfil no lado caro (quase tudo entrada) e nunca a estrutura do arquivo:
  // o extrato com um salário e doze saídas também tem "quase tudo do mesmo sinal", e virar
  // fatura fazia do salário um estorno. O motivo passa a ser o dos sinais, não o do perfil —
  // senão a tela dizia "parece uma fatura (extrato do Nubank)".
  let detectedReason = profile.reason;
  const sinaisDizemFatura =
    detectedKind === "unknown" ? looksLikeCardInvoice(parsedRaw) : detectedKind === "extrato" && sinaisDesmentemExtrato(parsedRaw, profile.reason);
  if (sinaisDizemFatura) {
    detectedKind = "fatura";
    detectedReason = MOTIVO_SINAIS_FATURA;
  }
  const repeatCount = new Map<string, number>();
  for (const txn of parsed) {
    const k = dedupeKey(txn.date, Math.abs(txn.amount), txn.description);
    repeatCount.set(k, (repeatCount.get(k) ?? 0) + 1);
  }

  const [rules, customCategories] = await Promise.all([listTransactionRules(ctx), listCustomCategories(ctx)]);
  const learned: LearnedRule[] = rules.map((r) => ({
    pattern: r.pattern,
    parentCategory: r.parentCategory,
    subcategory: r.subcategory ?? undefined,
  }));

  const comprasSaoPositivas = docType !== "fatura" || comprasDaFaturaSaoPositivas(parsed);
  const items: ReviewItem[] = parsed.map((txn, index) => {
    const isExpense = docType === "fatura" ? (comprasSaoPositivas ? txn.amount > 0 : txn.amount < 0) : txn.amount < 0;
    // Estorno: na fatura, todo crédito que não é linha de resumo é dinheiro de compra voltando
    // (antes virava RENDA e inflava o mês); no extrato, a entrada que diz que é estorno.
    const estorno = !isExpense && (docType === "fatura" || pareceEstorno(txn.description));
    // Categoriza saídas e estornos (o estorno desconta da categoria da compra). O tipo do
    // perfil escolhe as regras: na Empresa, "iFood" não é Mercadorias e insumos.
    const classification = isExpense || estorno ? classify(txn.description, learned, ctx.profileKind) : null;
    return {
      key: index,
      date: txn.date,
      description: txn.description,
      amount: Math.abs(txn.amount),
      category: isExpense || estorno ? "EXPENSE" : "INCOME",
      // Estorno sem categoria reconhecida vai pra Outros: sem categoria ele seria pulado e a
      // compra ficaria contando sozinha.
      parentCategory: classification?.parentCategory ?? (estorno ? "OUTROS" : null),
      customCategoryId: null,
      subcategory: classification?.subcategory ?? null,
      autoClassified: classification !== null || estorno,
      estorno,
      installment: docType === "fatura" ? parseInstallment(txn.description) : null,
      fileRepeat: (() => {
        const k = dedupeKey(txn.date, Math.abs(txn.amount), txn.description);
        const total = repeatCount.get(k) ?? 1;
        return total > 1 ? { key: k, total } : null;
      })(),
      profileId: null,
      // Crédito da fatura que fala em "pagamento" é o pagamento da fatura anterior escrito de
      // um jeito novo, não devolução de compra: como estorno, descontava a fatura anterior
      // inteira do mês. Fica de fora com o motivo à vista, e um toque traz de volta.
      ...(estorno && docType === "fatura" && pareceCreditoDePagamento(txn.description)
        ? { ignorar: true, nota: "Parece o pagamento da fatura anterior: fica de fora. Se foi devolução de compra, toque em Contar mesmo assim." }
        : {}),
    };
  });

  const stats: ParseStats = {
    detectedKind,
    detectedReason,
    summary: profile.summary,
    moneyLines,
    parsed: items.length,
    invoiceTotal: docType === "fatura" ? detectInvoiceTotal(text) : null,
    sumExpense: items.filter((i) => i.category === "EXPENSE").reduce((s, i) => s + (i.estorno ? -i.amount : i.amount), 0),
    sumIncome: items.filter((i) => i.category === "INCOME").reduce((s, i) => s + i.amount, 0),
    suspeitas: checarPlausibilidade(parsed, docType),
  };
  if (docType !== "fatura") await separarDinheiroProprio(ctx, items);
  await marcarPossiveisDuplicatas(ctx, items);
  const diagnosticId = await recordImportDiagnostic({
    userId: ctx.userId,
    target: docType,
    stage: "parse",
    ok: true,
    fileName: uploadedName,
    encoding,
    kind: profile.kind,
    institution: profile.institution,
    moneyLines,
    parsed: items.length,
    header: safeHeader(text),
    // Leitura implausível entra na mensagem pra aparecer na checagem diária. Sem isso ela é uma
    // importação "ok" como outra qualquer, e foi assim que quatro extratos corrompidos passaram
    // semanas no banco sem ninguém ficar sabendo.
    message: stats.suspeitas.length > 0 ? mensagemImplausivel(stats.suspeitas.map((x) => x.texto)) : null,
  });
  // Leu, mas achou muito menos do que o arquivo tinha: pra pessoa é "só veio um pedaço da
  // fatura". Guarda o arquivo também nesse caso — é o único jeito de conferir se o que ficou
  // de fora era transação de verdade ou só linha de resumo.
  if (isPartialRead(moneyLines, items.length)) {
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "parcial" });
  }
  // Leitura que saiu implausível guarda o arquivo pelo mesmo motivo: sem ele, não dá pra
  // descobrir qual coluna o app pegou errado. Foi exatamente o que faltou nos quatro casos que
  // já aconteceram — o número absurdo estava no banco e o arquivo, não.
  else if (stats.suspeitas.length > 0) {
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "implausivel" });
  }
  return { ok: true, items, customCategories: customCategories.map((c) => ({ id: c.id, name: c.name })), stats };
}

export type ConfirmedItem = {
  date: string;
  description: string;
  amount: number;
  category: EntryType;
  parentCategory: ParentCategory | null;
  /** Categoria personalizada (quando a pessoa escolheu/criou uma na revisão). */
  customCategoryId: string | null;
  subcategory: string | null;
  /** true quando o usuário definiu/ajustou a categoria na revisão, vira regra aprendida. */
  learn: boolean;
  installment?: { current: number; total: number; confident: boolean } | null;
  /** Perfil de destino escolhido na revisão; `null`/ausente = o perfil ativo de sempre. Validado
   * de novo no servidor (tem que ser um perfil do próprio usuário) antes de gravar. */
  profileId?: string | null;
  /** Estorno: grava como gasto negativo (ver ReviewItem.estorno). */
  estorno?: boolean;
};

/** Lançamento do extrato bancário que PODE ser o pagamento desta fatura — mostrado pra pessoa
 * decidir, nunca removido sozinho (fatura parcial não bate o valor exato, ver comentário em
 * findCardPaymentCandidates). */
export type CardPaymentCandidate = { id: string; description: string; amount: number; date: string | null };

export type ImportResult =
  | { ok: true; created: number; skipped: number; cardPaymentCandidates: CardPaymentCandidate[] }
  | { ok: false; error: string };

/** Reconhece a linha de "pagamento de fatura de cartão" que vem no EXTRATO bancário. */
const CARD_PAYMENT_RE = /fatura/i;
function looksLikeCardPayment(description: string | null): boolean {
  const d = (description ?? "").toLowerCase();
  return CARD_PAYMENT_RE.test(d) && (/pagament/.test(d) || /cart[aã]o/.test(d));
}

/** (ano, mês) do mês anterior/seguinte, sem depender de Date pra virada de ano (mês 1 → mês 12
 * do ano anterior, mês 12 → mês 1 do ano seguinte). */
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = (month - 1 + delta + 1200) % 12; // +1200 garante positivo mesmo com delta negativo
  const yearShift = Math.floor((month - 1 + delta) / 12);
  return { year: year + yearShift, month: zeroBased + 1 };
}

/**
 * Quando a pessoa importa a FATURA detalhada, procura no extrato já lançado (mês anterior, o
 * próprio mês e o seguinte — a fatura pode ser paga antes ou depois do mês das compras) linhas
 * que PARECEM ser o pagamento da fatura (descrição), pra ela decidir se remove. Não remove
 * sozinho: fatura raramente é paga por inteiro (pagamento mínimo, parcelamento, juros de
 * atraso), então o valor quase nunca bate exato com o total das compras — a pessoa é quem sabe
 * se aquele lançamento do extrato é mesmo esta fatura.
 */
async function findCardPaymentCandidates(ctx: AuthContext, year: number, month: number): Promise<CardPaymentCandidate[]> {
  const months = [shiftMonth(year, month, -1), { year, month }, shiftMonth(year, month, 1)];
  // Só do perfil ativo: a fatura do Pessoal não pode listar o pagamento feito pela Empresa (e a
  // remoção, que é por perfil, falhava calada).
  const candidates = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: months },
    select: { id: true, description: true, amount: true, entryDate: true },
    orderBy: { entryDate: "asc" },
  });
  // Valor negativo é estorno (gasto que voltou), nunca o pagamento saindo do extrato: o
  // "Pagamento da fatura" que uma fatura antiga deixou entrar como estorno aparecia aqui como
  // "− -R$ 2.800", e remover apagava o estorno em vez do pagamento.
  return candidates
    .filter((c) => Number(c.amount) > 0 && looksLikeCardPayment(c.description))
    .map((c) => ({
      id: c.id,
      description: c.description ?? "Pagamento de fatura",
      amount: Number(c.amount),
      date: c.entryDate ? c.entryDate.toISOString().slice(0, 10) : null,
    }));
}

/** Remove UM lançamento candidato a "pagamento de fatura" do extrato, só depois que a pessoa
 * confirma que é mesmo esta fatura (nunca automático). */
export async function removeCardPaymentCandidateAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const result = await prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  revalidatePath("/mensal/[year]/[month]", "page");
  return { ok: result.count > 0 };
}

function yearMonthFromISO(date: string): { year: number; month: number } | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** Descrição comparável: sem diferença de maiúscula/espaço nem de como o "N/T" da parcela foi
 * escrito ("PARC 04/06" do banco e "PARC 04/6" que versões antigas do app gravavam são a mesma). */
function descricaoComparavel(description: string | null): string {
  return installmentCanonical(description ?? "").trim().toLowerCase();
}

/** Chave de duplicata: mesma data + valor + descrição = mesma transação do extrato. */
function dedupeKey(date: string | null, amount: number, description: string | null): string {
  return `${date ?? ""}|${amount.toFixed(2)}|${descricaoComparavel(description)}`;
}

/** Parcela de fatura com CERTEZA (ver parseInstallment): só essas têm a comparação por parcela. */
function parcelaCerta(description: string | null) {
  const p = parseInstallment(description);
  return p?.confident ? p : null;
}

/** Parcela de fatura já gravada (sem dia), com o lote que a criou e o mês em que caiu (ano*12+mês). */
type ParcelaExistente = { valor: number; id: string; loteId: string | null; mes: number };

/** A mesma compra parcelada pode vir com centavos diferentes de um mês pro outro: a 1ª parcela
 * absorve o arredondamento (R$ 100 em 3x = 33,34 + 33,33 + 33,33). A diferença nunca passa de
 * um centavo por parcela. */
function mesmaParcela(a: number, b: number, total: number): boolean {
  return Math.abs(a - b) <= (total - 1) * 0.01 + 0.005;
}


const DIA_MS = 86_400_000;

/**
 * Extrato: separa o dinheiro dela indo pra ela mesma (ver lib/import/dinheiro-proprio). Aplicação
 * vira aporte sozinha; pagamento de fatura fica de fora pra quem importa a fatura; transferência
 * pra conta própria e resgate viram pergunta na revisão.
 */
async function separarDinheiroProprio(ctx: AuthContext, items: ReviewItem[]) {
  const [usuario, faturasRecentes] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    prisma.importBatch.count({ where: { userId: ctx.userId, profileId: ctx.profileId, docType: "fatura", createdAt: { gte: new Date(Date.now() - 120 * DIA_MS) } } }),
  ]);
  for (const item of items) {
    if (item.estorno) continue;
    if (item.category === "EXPENSE") {
      if (pareceAplicacao(item.description)) {
        Object.assign(item, { category: "INVESTMENT_CONTRIBUTION", parentCategory: null, customCategoryId: null, subcategory: null, nota: "Aplicação: entra como guardado, não como gasto." });
      } else if (parecePagamentoDeFatura(item.description)) {
        if (faturasRecentes > 0) {
          Object.assign(item, { ignorar: true, nota: "Pagamento da fatura: fica de fora porque você importa a fatura, e as compras dela já estão lançadas uma a uma." });
        }
      } else if (pareceContaPropria(item.description, usuario?.name)) {
        item.duvida = "conta_propria";
      }
    } else if (item.category === "INCOME") {
      if (pareceResgate(item.description)) item.duvida = "resgate";
      else if (pareceContaPropria(item.description, usuario?.name)) item.duvida = "conta_propria";
    }
  }
}

/**
 * Lançamento que a pessoa JÁ fez à mão e que agora vem no extrato/fatura: mesmo valor exato,
 * mesmo tipo e data até 3 dias de diferença. Não pula sozinho (pode ser coincidência): marca o
 * item pra tela perguntar "é o mesmo?". Cada lançamento à mão casa com um item só.
 */
async function marcarPossiveisDuplicatas(ctx: AuthContext, items: ReviewItem[]) {
  const datas = items.map((i) => Date.parse(`${i.date}T12:00:00Z`)).filter((t) => Number.isFinite(t));
  if (datas.length === 0) return;
  const de = new Date(Math.min(...datas) - 4 * DIA_MS);
  const ate = new Date(Math.max(...datas) + 4 * DIA_MS);
  const meses: { year: number; month: number }[] = [];
  for (let d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1)); d <= ate; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    meses.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  const manuais = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, importBatchId: null, externalId: null, OR: meses },
    select: { id: true, category: true, amount: true, entryDate: true, description: true, year: true, month: true },
  });
  const usados = new Set<string>();
  for (const item of items) {
    const t = Date.parse(`${item.date}T12:00:00Z`);
    if (!Number.isFinite(t)) continue;
    const valor = item.estorno ? -item.amount : item.amount;
    const par = manuais.find((m) => {
      if (usados.has(m.id) || m.category !== item.category || Math.abs(Number(m.amount) - valor) > 0.005) return false;
      if (m.entryDate) return Math.abs(m.entryDate.getTime() - t) <= 3 * DIA_MS + 12 * 3_600_000;
      // Lançamento à mão sem dia: basta ser do mesmo mês.
      return m.year === Number(item.date.slice(0, 4)) && m.month === Number(item.date.slice(5, 7));
    });
    if (!par) continue;
    usados.add(par.id);
    item.possivelDuplicata = { descricao: par.description ?? "(sem descrição)", data: par.entryDate ? par.entryDate.toISOString().slice(0, 10) : null };
  }
}

/**
 * Cria os lançamentos escolhidos e memoriza as categorias definidas manualmente (item 3).
 * Transações idênticas já lançadas (mesma data+valor+descrição) são puladas, importar o
 * mesmo extrato duas vezes não duplica nada.
 *
 * Fatura: `targetYear`/`targetMonth` mandam — TODAS as compras entram nesse mês escolhido pela
 * pessoa (não no mês de cada compra individual, que pode espalhar pelo período de fechamento,
 * nem no mês corrente do servidor). Sem data específica no lançamento (entryDate fica vazio):
 * "lançar tudo junto no dia que paguei a fatura", não no dia de cada compra. A checagem de
 * duplicata continua usando a data ORIGINAL de cada compra (não a escolhida), senão uma
 * assinatura recorrente (mesma descrição+valor todo mês) seria ignorada como se já existisse.
 */
export async function importTransactionsAction(
  items: ConfirmedItem[],
  docType: "extrato" | "fatura" = "extrato",
  targetYear?: number,
  targetMonth?: number,
  fileName?: string,
): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  const now = new Date();
  const touchedMonths = new Set<string>();
  let created = 0;
  let skipped = 0;

  // Todo upload vira um "lote": é o que dá o histórico de importações e permite desfazer o
  // arquivo inteiro depois (upload errado/duplicado). Se nada for criado, o lote é removido.
  const batch = await createImportBatch(ctx, { docType, fileName });

  const faturaTarget =
    docType === "fatura" && targetYear && targetMonth ? { year: targetYear, month: targetMonth } : null;

  // Cada linha pode ir pro perfil ativo ou pra OUTRO perfil do usuário (fatura Pessoal com
  // compra da Empresa, por exemplo — ver `profileId` em ReviewItem). Um id que não é REALMENTE
  // de um perfil do usuário é ignorado, sem quebrar o lançamento nem vazar dado de outra conta.
  const ownProfileIds = new Set((await listProfiles(ctx.userId)).map((p) => p.id));
  const profileIdOf = (item: ConfirmedItem): string =>
    item.profileId && ownProfileIds.has(item.profileId) ? item.profileId : ctx.profileId;

  // Categoria personalizada só vale se for do MESMO perfil de destino do lançamento — uma
  // categoria da Pessoal não existe pro banco quando o lançamento é gravado na Empresa. Busca
  // todas de uma vez (sem filtrar por perfil) e agrupa, em vez de uma consulta por perfil.
  const customCategoriesByProfile = new Map<string, Set<string>>();
  for (const cc of await prisma.customCategory.findMany({ where: { userId: ctx.userId }, select: { id: true, profileId: true } })) {
    if (!cc.profileId) continue; // categoria de antes dos perfis, sem dono — não entra em nenhum grupo
    if (!customCategoriesByProfile.has(cc.profileId)) customCategoriesByProfile.set(cc.profileId, new Set());
    customCategoriesByProfile.get(cc.profileId)!.add(cc.id);
  }

  // Meses afetados pela importação → busca os lançamentos existentes deles de uma vez. Entram
  // também os meses das PARCELAS futuras: sem eles, subir a fatura de outubro recriava as
  // parcelas que a fatura de setembro já tinha lançado, e a cada mês sobrava mais uma cópia.
  // A chave leva o PERFIL de destino junto: mesma data/valor/descrição em perfis diferentes
  // (Pessoal e Empresa) não é duplicata uma da outra, é o mesmo gasto do cartão dividido em duas contas.
  const monthOf = (item: ConfirmedItem) =>
    faturaTarget ?? yearMonthFromISO(item.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
  const monthsInBatch = new Set<string>();
  for (const item of items) {
    const ym = monthOf(item);
    const profileId = profileIdOf(item);
    monthsInBatch.add(`${profileId}|${ym.year}/${ym.month}`);
    if (faturaTarget && item.installment?.confident && item.installment.current < item.installment.total) {
      for (let n = item.installment.current + 1; n <= item.installment.total; n += 1) {
        const d = new Date(ym.year, ym.month - 1 + (n - item.installment.current), 1);
        monthsInBatch.add(`${profileId}|${d.getFullYear()}/${d.getMonth() + 1}`);
      }
    }
  }
  // CONTAGEM, não presença: quem tem dois cafés iguais no mesmo dia (e escolheu manter os dois
  // na revisão) fica com os dois. Só é pulado o que já existe no banco, um a um.
  const existingCounts = new Map<string, number>();
  // Segunda chave, sem a descrição: mesma data + mesmo valor + mesmo tipo, só contra o que JÁ
  // veio de um arquivo. É o extrato da semana subido de novo no fim do mês (ou em outro formato,
  // CSV numa semana e PDF no mês), em que o banco escreve a mesma transação de outro jeito.
  const looseCounts = new Map<string, number>();
  // Terceira, só pra parcela de fatura: mesma descrição (com o "N/T" normalizado) e valor com a
  // folga dos centavos (ver mesmaParcela). Sem ela, "PARC 02/03" de R$ 33,33 não batia com a
  // parcela 02/03 de R$ 33,34 que a fatura anterior já tinha lançado, e a compra duplicava.
  // Guarda o id e o lote de cada uma: a parcela que esta fatura confirma passa a ser dela (ver `adotar`).
  const parcelasExistentes = new Map<string, ParcelaExistente[]>();
  for (const key of monthsInBatch) {
    const [profileId, ym] = key.split("|");
    const [y, m] = ym.split("/").map(Number);
    const existing = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId, year: y, month: m },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, importBatchId: true },
    });
    for (const e of existing) {
      const dia = e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null;
      const k = `${profileId}|${y}/${m}|${dedupeKey(dia, Number(e.amount), e.description)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      if (!dia && Number(e.amount) > 0 && parcelaCerta(e.description)) {
        const pk = `${profileId}|${y}/${m}|${descricaoComparavel(e.description)}`;
        parcelasExistentes.set(pk, [...(parcelasExistentes.get(pk) ?? []), { valor: Number(e.amount), id: e.id, loteId: e.importBatchId, mes: y * 12 + m }]);
      }
      if (dia && e.importBatchId) {
        const lk = `${profileId}|${dia}|${Number(e.amount).toFixed(2)}|${e.category}`;
        looseCounts.set(lk, (looseCounts.get(lk) ?? 0) + 1);
      }
    }
  }
  // Mês da fatura de cada lote que lançou parcela = o primeiro mês em que ele gravou algo (as
  // compras vão todas pro mês escolhido; só as parcelas projetadas caem depois). Parcela num mês
  // DEPOIS desse foi projetada ("as seguintes entram sozinhas"), não veio na fatura daquele lote.
  const lotesComParcela = [...new Set([...parcelasExistentes.values()].flat().flatMap((p) => (p.loteId ? [p.loteId] : [])))];
  const mesDaFaturaDoLote = new Map<string, number>();
  if (faturaTarget && lotesComParcela.length > 0) {
    const mesesDosLotes = await prisma.monthlyEntry.findMany({
      // Todos os perfis dela: o lote é de um perfil, mas a revisão pode ter mandado linhas pra outro.
      where: { userId: ctx.userId, profileId: { in: [...ownProfileIds] }, importBatchId: { in: lotesComParcela } },
      select: { importBatchId: true, year: true, month: true },
      distinct: ["importBatchId", "year", "month"],
    });
    for (const { importBatchId, year, month } of mesesDosLotes) {
      if (!importBatchId) continue;
      const mes = year * 12 + month;
      mesDaFaturaDoLote.set(importBatchId, Math.min(mesDaFaturaDoLote.get(importBatchId) ?? mes, mes));
    }
  }
  const ehProjecao = (p: ParcelaExistente) => p.loteId !== null && p.mes > (mesDaFaturaDoLote.get(p.loteId) ?? Infinity);
  /**
   * A parcela que outro lote PROJETOU e esta fatura confirma passa pra este lote. Sem isso,
   * desfazer a fatura de setembro (que tinha projetado 04..12) apagava também a parcela de
   * outubro que a fatura de outubro trouxe e pulou como "já existia", e o mês perdia o gasto
   * sem aviso. A linha que a fatura do outro lote trazia de verdade (mesma fatura subida de
   * novo) não muda de dono: desfazer a cópia não pode levar a original.
   */
  let adotados = 0;
  const adotar = async (id: string, profileId: string, year: number, month: number) => {
    const r = await prisma.monthlyEntry.updateMany({ where: { id, userId: ctx.userId, profileId }, data: { importBatchId: batch.id } });
    adotados += r.count;
    if (r.count > 0) touchedMonths.add(`${year}/${month}`);
  };

  /** Já existe no banco uma cópia ainda não "gasta" desta chave? Consome uma e diz que sim. */
  const alreadyThere = (k: string, counts = existingCounts) => {
    const left = counts.get(k) ?? 0;
    if (left <= 0) return false;
    counts.set(k, left - 1);
    return true;
  };
  /** Estorno é gravado negativo: a chave tem que usar o mesmo sinal que está no banco. */
  const valorGravado = (item: ConfirmedItem) => (item.estorno && item.category === "EXPENSE" ? -item.amount : item.amount);
  const chaveExata = (item: ConfirmedItem) => {
    const originalYm = yearMonthFromISO(item.date);
    const ym = faturaTarget ?? originalYm ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
    return `${profileIdOf(item)}|${ym.year}/${ym.month}|${dedupeKey(!faturaTarget && originalYm ? item.date : null, valorGravado(item), item.description)}`;
  };
  /** Já existe esta parcela (valor com folga de centavos)? Consome uma e devolve qual era. */
  const parcelaJaLancada = (k: string, valor: number, total: number): ParcelaExistente | null => {
    const existentes = parcelasExistentes.get(k) ?? [];
    const i = existentes.findIndex((p) => mesmaParcela(p.valor, valor, total));
    if (i === -1) return null;
    return existentes.splice(i, 1)[0];
  };
  /** Parcela de fatura usa SÓ a comparação por parcela (que já cobre o valor exato); o resto usa
   * a chave exata. Como os dois lados decidem pela mesma descrição, um lançamento do banco nunca
   * é "gasto" duas vezes, uma por cada caminho. */
  const chaveParcela = (item: ConfirmedItem) => {
    const parcela = faturaTarget && !item.estorno ? parcelaCerta(item.description) : null;
    return parcela
      ? { key: `${profileIdOf(item)}|${faturaTarget!.year}/${faturaTarget!.month}|${descricaoComparavel(item.description)}`, total: parcela.total }
      : null;
  };
  const chaveSolta = (item: ConfirmedItem) =>
    !faturaTarget && yearMonthFromISO(item.date) ? `${profileIdOf(item)}|${item.date}|${valorGravado(item).toFixed(2)}|${item.category}` : null;
  // Duas passadas: primeiro o que bate EXATO (mesma descrição), depois, só entre os que sobraram,
  // o que bate por data + valor. Na ordem inversa, o "Uber R$ 15" novo podia consumir a vaga do
  // "99 R$ 15" já importado, e o 99 entrava de novo.
  const pular = new Set<number>();
  // Parcela pulada que era projeção de outro lote: índice → a parcela (ver `adotar`).
  const confirmadas = new Map<number, ParcelaExistente>();
  items.forEach((item, i) => {
    if (item.amount <= 0) return;
    const parcela = chaveParcela(item);
    const achada = parcela ? parcelaJaLancada(parcela.key, valorGravado(item), parcela.total) : null;
    if (achada && ehProjecao(achada)) confirmadas.set(i, achada);
    if (parcela ? achada !== null : alreadyThere(chaveExata(item))) {
      pular.add(i);
      const solta = chaveSolta(item);
      if (solta) alreadyThere(solta, looseCounts);
    }
  });
  items.forEach((item, i) => {
    if (item.amount <= 0 || pular.has(i)) return;
    const solta = chaveSolta(item);
    if (solta && alreadyThere(solta, looseCounts)) pular.add(i);
  });

  /**
   * Compra parcelada: as parcelas que ainda vêm entram nos meses seguintes, no mesmo lote
   * (desfazer o lote leva todas). "03/10" em setembro vira 04/10 em outubro… até 10/10.
   * `confident`: "POSTO SHELL 03/09" é data de compra, não parcela 3 de 9 — sem essa checagem
   * o app inventava seis gastos nos meses seguintes. `adotarDe`: a parcela desta fatura era
   * projeção desse lote; as seguintes que ele projetou passam pra este (ver `adotar`), e nada
   * novo é criado (foi assim antes: a parcela que já existia só era pulada).
   */
  const lancarParcelasFuturas = async (
    item: ConfirmedItem,
    ym: { year: number; month: number },
    profileId: string,
    parentCategory: ParentCategory | undefined,
    customCategoryId: string | undefined,
    adotarDe: string | null,
  ) => {
    if (!faturaTarget || item.estorno || !item.installment?.confident || item.installment.current >= item.installment.total) return;
    const { current, total } = item.installment;
    for (let n = current + 1; n <= total; n += 1) {
      const offset = n - current;
      const d = new Date(ym.year, ym.month - 1 + offset, 1);
      const desc = installmentDescription(item.description, n, total);
      // Com o perfil na frente, como todas as chaves de lançamentos existentes: sem ele a
      // checagem nunca achava nada, e subir as faturas fora de ordem (outubro antes de
      // setembro) recriava as parcelas que já estavam lá.
      const futureKey = `${profileId}|${d.getFullYear()}/${d.getMonth() + 1}|${descricaoComparavel(desc)}`;
      const achada = parcelaJaLancada(futureKey, item.amount, total);
      if (achada) {
        if (adotarDe && achada.loteId === adotarDe) await adotar(achada.id, profileId, d.getFullYear(), d.getMonth() + 1);
        continue;
      }
      // Só adotando: a parcela projetada que não está mais lá foi apagada por ela, não volta.
      if (adotarDe) continue;
      await createMonthlyEntry(ctx, {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        category: item.category,
        parentCategory: item.category === "EXPENSE" ? parentCategory : undefined,
        customCategoryId,
        subcategory: item.subcategory ?? undefined,
        description: desc,
        amount: item.amount,
        importBatchId: batch.id,
        profileId,
      });
      created += 1;
      touchedMonths.add(`${d.getFullYear()}/${d.getMonth() + 1}`);
    }
  };

  for (const [indice, item] of items.entries()) {
    if (item.amount <= 0) continue;
    const profileId = profileIdOf(item);
    const ownCustomIds = customCategoriesByProfile.get(profileId) ?? new Set<string>();
    const customCategoryId =
      item.category === "EXPENSE" && item.customCategoryId && ownCustomIds.has(item.customCategoryId)
        ? item.customCategoryId
        : undefined;
    // Categoria personalizada e categoria-mãe são exclusivas: com uma custom, a mãe fica de fora.
    const parentCategory =
      !customCategoryId && item.parentCategory && PARENT_CATEGORY_VALUES.includes(item.parentCategory)
        ? item.parentCategory
        : undefined;

    // Fatura com mês escolhido: todas as compras vão pro MESMO mês, não no de cada compra.
    // Sem isso, uma fatura com período de fechamento cruzando dois meses (ex.: 13/06 a 13/07)
    // espalhava os lançamentos em dois meses diferentes, ou caía no mês corrente do servidor.
    const originalYm = yearMonthFromISO(item.date);
    const ym = faturaTarget ?? originalYm ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
    // A chave tem que ser a MESMA dos dois lados. Em fatura o lançamento é gravado sem dia
    // (entryDate nulo), então a chave também vai sem data — com a data da compra, nenhuma
    // chave batia e subir a mesma fatura duas vezes duplicava a fatura inteira. A confusão com
    // assinatura recorrente não acontece porque a busca é feita mês a mês.
    if (pular.has(indice)) {
      skipped += 1;
      const confirmada = confirmadas.get(indice);
      if (confirmada) {
        await adotar(confirmada.id, profileId, ym.year, ym.month);
        // As parcelas seguintes que o mesmo lote projetou também passam pra esta fatura.
        await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, confirmada.loteId);
      }
      continue;
    }

    await createMonthlyEntry(ctx, {
      year: ym.year,
      month: ym.month,
      category: item.category,
      parentCategory: item.category === "EXPENSE" ? parentCategory : undefined,
      customCategoryId,
      subcategory: item.subcategory ?? undefined,
      description: item.description,
      amount: valorGravado(item),
      // Fatura: sem dia específico (lança "no mês", não "no dia da compra"). Extrato: mantém a
      // data exata de cada transação, como sempre foi.
      entryDate: !faturaTarget && originalYm ? new Date(`${item.date}T12:00:00`) : undefined,
      importBatchId: batch.id,
      profileId,
    });
    created += 1;
    touchedMonths.add(`${ym.year}/${ym.month}`);

    await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, null);

    // Aprende a classificação só para gastos com categoria definida pelo usuário.
    if (item.learn && item.category === "EXPENSE" && parentCategory) {
      const pattern = normalizeMerchant(item.description);
      if (pattern) {
        // A regra mora no perfil pra onde a linha FOI, não no aberto: a compra da Kalunga
        // mandada pra Empresa como "Mercadorias e insumos" (chave ALIMENTACAO) virava
        // "Alimentação" na próxima importação da Pessoal, e a Empresa não aprendia nada.
        await upsertTransactionRule({ ...ctx, profileId }, { pattern, parentCategory, subcategory: item.subcategory ?? undefined });
      }
    }
  }

  // Upload que só tinha duplicata não criou nada: não polui o histórico com lote vazio. (O que
  // só confirmou parcelas projetadas por outro lote não está vazio: agora elas são dele.)
  if (created === 0 && adotados === 0) await deleteEmptyImportBatch(ctx, batch.id);

  // Fatura: lista candidatos a "pagamento de fatura" no extrato pra pessoa decidir se remove
  // (evita contar em dobro), sem apagar nada sozinho.
  const cardPaymentCandidates =
    faturaTarget && created > 0 ? await findCardPaymentCandidates(ctx, faturaTarget.year, faturaTarget.month) : [];

  for (const key of touchedMonths) {
    const [year, month] = key.split("/");
    revalidatePath(`/mensal/${year}`);
    revalidatePath(`/mensal/${year}/${month}`);
  }

  await recordImportDiagnostic({
    userId: ctx.userId,
    target: docType,
    stage: "confirm",
    ok: true,
    fileName,
    parsed: items.length,
    created,
    skipped,
  });
  return { ok: true, created, skipped, cardPaymentCandidates };
}

/**
 * Desfaz um lote de importação: apaga o lote E todos os lançamentos que aquele upload criou
 * (upload errado ou duplicado). Só afeta lotes do próprio usuário.
 */
export async function deleteImportBatchAction(id: string): Promise<{ ok: boolean; removed: number }> {
  const ctx = await getRequiredSession();
  const removed = await deleteImportBatchWithEntries(ctx, id);
  revalidatePath("/mensal", "layout");
  return { ok: removed >= 0, removed };
}
