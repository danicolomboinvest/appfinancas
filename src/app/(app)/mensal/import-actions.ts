"use server";

import { ehCasal } from "@/lib/profiles/casal";
import { ehPessoa } from "@/lib/casal/acerto";
import { revalidatePath } from "next/cache";
import { installmentCanonical, installmentDescription, parseInstallment } from "@/lib/entries/recurrence";
import { countMoneyLines, detectInvoiceTotal, looksLikeCardInvoice, MOTIVO_SINAIS_FATURA, periodoSemMovimento, sinaisDesmentemExtrato, type DocKind } from "@/lib/import/detect";
import { profileDocument } from "@/lib/import/profile";
import { checarPlausibilidade, type Suspeita } from "@/lib/import/plausibility";
import { isPartialRead, MARCA_CONFERIDO, MARCA_NAO_FECHOU, mensagemImplausivel, recordImportDiagnostic, safeHeader } from "@/lib/repositories/import-diagnostic.repo";
import { conferirLeitura, leituraIncompleta, type Conferencia } from "@/lib/import/conferencia";
import { storeFailedImportFile } from "@/lib/repositories/import-file.repo";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { MSG_TROCOU_DE_PERFIL, trocouDePerfil } from "@/lib/profiles/perfil-da-tela";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import {
  createImportBatch,
  deleteEmptyImportBatch,
  deleteImportBatchWithEntries,
} from "@/lib/repositories/import-batch.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { descricoesOriginais } from "@/lib/repositories/decisao.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatementComLeitor } from "@/lib/import/statement-parser";
import { isFaturaSummaryLine, comprasDaFaturaSaoPositivas, pareceCreditoDePagamento } from "@/lib/import/fatura-lines";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { pdfTextQuality } from "@/lib/import/pdf-quality";
import { classify, classifyLearnedOnly, normalizeMerchant, type LearnedRule } from "@/lib/import/classify";
import { categoriaDoBancoParaOApp } from "@/lib/import/categoria-do-banco";
import { classificarPelaComunidade } from "@/lib/import/comunidade";
import { regrasDaComunidade } from "@/lib/repositories/comunidade.repo";
import { pareceEstorno } from "@/lib/import/estorno";
import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "@/lib/import/dinheiro-proprio";
import { casarPorDataEValor, type ExistenteSolto } from "@/lib/import/duplicata-solta";
import { detectarVencimento } from "@/lib/import/vencimento";

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
  /** Parece com um lançamento que a pessoa já fez à mão (mesmo valor, data perto), ou com um de
   * outra importação (mesmo dia, valor e tipo, descrição diferente): a tela pergunta.
   * `importado` diz qual dos dois, pra tela não dizer "você lançou" do que veio de arquivo. */
  possivelDuplicata?: {
    descricao: string;
    data: string | null;
    importado?: boolean;
    /** Lançamento à mão: o id e o valor dele. Com "é o mesmo", ele fica com o valor e a data do extrato. */
    id?: string;
    valor?: number;
  } | null;
  /** Fica de fora da importação (pagamento de fatura de quem importa a fatura, "só mudei de conta"). */
  ignorar?: boolean;
  /** Por que o app tratou a linha diferente ("Aplicação: entra como guardado"). */
  nota?: string | null;
  /** Dinheiro que pode ser dela mesma: a tela pergunta antes de importar. */
  duvida?: "conta_propria" | "resgate" | null;
  /** Resgate: dinheiro voltando do que ela guardou. Grava como guardado NEGATIVO (ver
   * lib/entries/resgate.ts) e a carteira pergunta de qual investimento saiu. */
  resgate?: boolean;
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
  /** A soma lida bateu com o total que o próprio documento imprime? (ver conferencia.ts) */
  conferencia: Conferencia;
  /** Faltou coisa de verdade na leitura — a MESMA régua do relatório diário e do arquivo guardado. */
  leituraIncompleta: boolean;
  /** Fatura: o vencimento impresso no arquivo ("YYYY-MM-DD"), pra tela já sugerir o mês em que
   * ela entra. null quando não é fatura ou o arquivo não diz (ver lib/import/vencimento.ts). */
  vencimento: string | null;
};

export type ParseStatementResult =
  | { ok: true; items: ReviewItem[]; customCategories: { id: string; name: string }[]; stats: ParseStats }
  | { ok: false; error: string; needsPassword?: boolean };

/** A conferência vai na mensagem do diagnóstico: é o que o relatório diário e o aviso de suporte
 * leem pra saber se faltou coisa (ver `leituraIncompletaDoRegistro`). */
function mensagemDaConferencia(conf: Conferencia, incompleta: boolean): string | null {
  // O documento importado é em real: o valor impresso nele vem em real, seja qual for a moeda da conta.
  const reais = (n: number) => formatMoney(n, "BRL");
  if (incompleta) {
    return conf.status === "nao-fechou"
      ? `${MARCA_NAO_FECHOU} li ${reais(conf.lido)}, o arquivo diz ${reais(conf.esperado)}`
      : null; // sem total pra conferir: a régua das linhas continua valendo pra esta linha
  }
  return conf.status === "fechou" ? `${MARCA_CONFERIDO} bateu com o total do arquivo (${reais(conf.esperado)})` : MARCA_CONFERIDO;
}

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
  const { txns: parsedRaw, leitor } = parseStatementComLeitor(text, source, faturaYear);
  // Fatura: linhas de RESUMO ("pagamento efetuado", "total de compras", "total de crédito
  // recebido") são agregados que a própria fatura já detalha em outras linhas — não são uma
  // compra a mais. Sem isso, o "pagamento de fatura" virava um gasto extra na revisão.
  const parsed = docType === "fatura" ? parsedRaw.filter((txn) => !isFaturaSummaryLine(txn)) : parsedRaw;
  const moneyLines = countMoneyLines(text);
  if (parsed.length === 0) {
    // Diagnóstico pro suporte: só o perfil do arquivo. A primeira linha do extrato saía aqui sem
    // máscara (nome do titular, número da conta) e os logs da Vercel não são lugar disso (04/10/2026).
    console.error("parseStatementAction: zero lançamentos", { fileName, encoding, docType, kind: profile.kind, institution: profile.institution, moneyLines, chars: text.length });
    const msg = periodoSemMovimento(text)
      ? `Esse arquivo não tem nenhum lançamento: o período escolhido no app do banco não teve movimentação. Baixe de novo escolhendo um período maior (o mês inteiro, por exemplo).`
      : moneyLines > 3
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

  const comunidade = ctx.profileKind === "EMPRESA" ? new Map() : await regrasDaComunidade();
  const comprasSaoPositivas = docType !== "fatura" || comprasDaFaturaSaoPositivas(parsed);
  const items: ReviewItem[] = parsed.map((txn, index) => {
    const isExpense = docType === "fatura" ? (comprasSaoPositivas ? txn.amount > 0 : txn.amount < 0) : txn.amount < 0;
    // Estorno: na fatura, todo crédito que não é linha de resumo é dinheiro de compra voltando
    // (antes virava RENDA e inflava o mês); no extrato, a entrada que diz que é estorno.
    const estorno = !isExpense && (docType === "fatura" || pareceEstorno(txn.description));
    // Categoriza saídas e estornos (o estorno desconta da categoria da compra). O tipo do
    // perfil escolhe as regras: na Empresa, "iFood" não é Mercadorias e insumos.
    // Sem regra dela nem do app, o que as outras clientes escolheram pra mesma loja (Pessoal só).
    // Ordem (03/10/2026): a correção DELA > a categoria que o BANCO escreveu na fatura > o palpite
    // embutido do app > o que as outras clientes escolheram. O banco sabe o ramo da loja pelo
    // cadastro na maquininha; o app só adivinha pelo nome. Na Empresa, as categorias são outras.
    const categorizar = isExpense || estorno;
    const dela = categorizar ? classifyLearnedOnly(txn.description, learned) : null;
    const doBanco = categorizar && !dela && ctx.profileKind !== "EMPRESA" ? categoriaDoBancoParaOApp(txn.categoriaDoBanco) : null;
    const doApp = dela ?? (doBanco ? { parentCategory: doBanco } : categorizar ? classify(txn.description, learned, ctx.profileKind) : null);
    const daComunidade = !doApp && isExpense ? classificarPelaComunidade(txn.description, comunidade) : null;
    const classification = doApp ?? (daComunidade ? { parentCategory: daComunidade } : null);
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
    conferencia: conferirLeitura(text, docType, parsed),
    leituraIncompleta: false,
    // Também quando ela escolheu "extrato" e o arquivo parece fatura: a pergunta "é fatura?"
    // mostra o mês, e o mês certo é o do vencimento.
    vencimento: docType === "fatura" || detectedKind === "fatura" ? detectarVencimento(text) : null,
  };
  stats.leituraIncompleta = leituraIncompleta(stats.conferencia, leitor !== null, isPartialRead(moneyLines, items.length));
  if (docType !== "fatura") await separarDinheiroProprio(ctx, items);
  await marcarPossiveisDuplicatas(ctx, items);
  // Fatura não tem a chave solta (entra sem dia): só o extrato compara com outras importações.
  if (docType !== "fatura") await marcarParecidosDeOutraImportacao(ctx, items);
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
    message:
      stats.suspeitas.length > 0
        ? mensagemImplausivel(stats.suspeitas.map((x) => x.texto))
        : mensagemDaConferencia(stats.conferencia, stats.leituraIncompleta),
  });
  // Leu, mas achou muito menos do que o arquivo tinha: pra pessoa é "só veio um pedaço da
  // fatura". Guarda o arquivo também nesse caso — é o único jeito de conferir se o que ficou
  // de fora era transação de verdade ou só linha de resumo.
  if (stats.leituraIncompleta) {
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
  /** Resgate: grava como guardado negativo (ver ReviewItem.resgate). */
  resgate?: boolean;
};

/** Lançamento do extrato bancário que PODE ser o pagamento desta fatura — mostrado pra pessoa
 * decidir, nunca removido sozinho (fatura parcial não bate o valor exato, ver comentário em
 * findCardPaymentCandidates). */
export type CardPaymentCandidate = { id: string; description: string; amount: number; date: string | null };

export type ImportResult =
  | { ok: true; created: number; skipped: number; cardPaymentCandidates: CardPaymentCandidate[] }
  | { ok: false; error: string };

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
    // A MESMA regra que deixa o pagamento de fora na leitura do extrato (ver dinheiro-proprio):
    // com duas, "PGTO FATURA" e o "Pagto cartão crédito" do BB passavam numa e não na outra, e a
    // fatura não oferecia remover o pagamento que o extrato já tinha lançado.
    .filter((c) => Number(c.amount) > 0 && parecePagamentoDeFatura(c.description))
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
  /*
   * Duas passadas. A primeira é a de sempre: valor exato e até 3 dias. A segunda (03/10/2026) é
   * a conta lançada antes de pagar: quem lança o aluguel com a data do vencimento e paga dias
   * antes, ou a conta de luz prevista em R$ 180 que veio R$ 192, não era perguntada e entrava em
   * dobro. Só gasto, até 7 dias e até 15% de diferença. Continua sendo PERGUNTA, nunca pula sozinho.
   */
  const passadas: ((m: (typeof manuais)[number], item: ReviewItem, valor: number, t: number) => boolean)[] = [
    (m, item, valor, t) => {
      if (Math.abs(Number(m.amount) - valor) > 0.005) return false;
      if (m.entryDate) return Math.abs(m.entryDate.getTime() - t) <= 3 * DIA_MS + 12 * 3_600_000;
      // Lançamento à mão sem dia: basta ser do mesmo mês.
      return m.year === Number(item.date.slice(0, 4)) && m.month === Number(item.date.slice(5, 7));
    },
    (m, item, valor, t) =>
      item.category === "EXPENSE" &&
      valor > 0 &&
      m.entryDate !== null &&
      Math.abs(m.entryDate.getTime() - t) <= 7 * DIA_MS + 12 * 3_600_000 &&
      Math.abs(Number(m.amount) - valor) <= valor * 0.15,
  ];
  for (const casa of passadas) {
    for (const item of items) {
      if (item.possivelDuplicata) continue;
      const t = Date.parse(`${item.date}T12:00:00Z`);
      if (!Number.isFinite(t)) continue;
      const valor = item.estorno ? -item.amount : item.amount;
      const par = manuais.find((m) => !usados.has(m.id) && m.category === item.category && casa(m, item, valor, t));
      if (!par) continue;
      usados.add(par.id);
      item.possivelDuplicata = {
        descricao: par.description ?? "(sem descrição)",
        data: par.entryDate ? par.entryDate.toISOString().slice(0, 10) : null,
        id: par.id,
        valor: Number(par.amount),
      };
    }
  }
}

/**
 * "É o mesmo" de um lançamento à mão com valor ou data diferentes do extrato: o lançamento fica
 * com o que de fato aconteceu (valor e dia do extrato), e a linha do extrato não entra. A conta
 * prevista vira a conta paga, sem duplicar e sem ficar com o valor estimado.
 */
export async function conciliarComExtratoAction(input: { id: string; valor: number; data: string }): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  const valor = Math.round(Number(input.valor) * 100) / 100;
  const dia = new Date(`${input.data}T12:00:00`);
  if (typeof input.id !== "string" || !(valor > 0) || valor > 1e8 || Number.isNaN(dia.getTime())) return { error: "Dados inválidos." };
  const r = await prisma.monthlyEntry.updateMany({
    where: { id: input.id, userId: ctx.userId, profileId: ctx.profileId, importBatchId: null, category: "EXPENSE" },
    data: { amount: valor, entryDate: dia, year: dia.getFullYear(), month: dia.getMonth() + 1 },
  });
  if (r.count === 0) return { error: "Não achei esse lançamento." };
  revalidatePath("/mensal", "layout");
  return {};
}

/** Chave solta (ver lib/import/duplicata-solta): mesmo dia, mesmo valor gravado e mesmo tipo. */
function chaveSoltaDe(date: string, valorGravado: number, category: string): string {
  return `${date}|${valorGravado.toFixed(2)}|${category}`;
}

/**
 * Extrato: linha com o mesmo dia, valor e tipo de um lançamento que JÁ veio de outra importação,
 * mas com outra descrição. Pode ser o mesmo extrato em outro formato ou um gasto de outra conta
 * (o Pix de R$ 100 no Nubank e o saque de R$ 100 no Itaú). Antes a confirmação pulava calada;
 * agora a revisão pergunta, mostrando o que já está lá. Descrição igual continua pulando sozinha
 * na confirmação, sem pergunta: é o mesmo arquivo de novo.
 */
async function marcarParecidosDeOutraImportacao(ctx: AuthContext, items: ReviewItem[]) {
  const meses = [...new Set(items.flatMap((i) => (yearMonthFromISO(i.date) ? [i.date.slice(0, 7)] : [])))].map((ym) => ({
    year: Number(ym.slice(0, 4)),
    month: Number(ym.slice(5, 7)),
  }));
  if (meses.length === 0) return;
  const [importados, nomesDoBanco] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, importBatchId: { not: null }, entryDate: { not: null }, OR: meses },
      select: { id: true, entryDate: true, amount: true, description: true, category: true },
    }),
    descricoesOriginais(ctx, [ctx.profileId]),
  ]);
  const existentes = new Map<string, ExistenteSolto[]>();
  for (const e of importados) {
    if (!e.entryDate) continue;
    const k = chaveSoltaDe(e.entryDate.toISOString().slice(0, 10), Number(e.amount), e.category);
    // Compara pelo nome do banco (o mesmo da confirmação) e mostra o nome que ela deu.
    existentes.set(k, [...(existentes.get(k) ?? []), { descricao: nomesDoBanco.get(e.id) ?? e.description, mostrar: e.description }]);
  }
  const chaves = items.map((it) =>
    it.amount > 0 && yearMonthFromISO(it.date) ? chaveSoltaDe(it.date, it.estorno && it.category === "EXPENSE" ? -it.amount : it.amount, it.category) : null,
  );
  const casados = casarPorDataEValor(chaves, items.map((it) => it.description), existentes, { perguntar: true });
  for (const [i, c] of casados) {
    // A pergunta do lançamento à mão já cobre a linha: uma pergunta por linha.
    if (c.tipo !== "parecido" || items[i].possivelDuplicata) continue;
    items[i].possivelDuplicata = { descricao: c.descricao ?? "(sem descrição)", data: items[i].date, importado: true };
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
  /** O perfil que a tela de revisão mostrava (ver perfil-da-tela.ts). */
  perfilDaTela?: string | null,
  /** Perfil Casal: de quem é o extrato ("A"/"B"). Todas as linhas que ficam no perfil levam o nome. */
  pessoaDoExtrato?: string | null,
): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  // Só no Casal, e só nas linhas que ficam nele (a que foi mandada pra outro perfil não leva).
  const pessoaDasLinhas = ehCasal(ctx.profileKind) && ehPessoa(pessoaDoExtrato) ? pessoaDoExtrato : undefined;
  const pessoaPara = (destino: string | undefined) => (destino === undefined || destino === ctx.profileId ? pessoaDasLinhas : undefined);
  // A revisão foi montada num perfil (as categorias, os "mandar pra outro perfil") e as linhas
  // sem perfil próprio iam pro ATIVO na hora do toque: trocar de perfil noutro aparelho no meio
  // da revisão punha o extrato inteiro da Empresa no Pessoal, com o lote no histórico errado.
  if (trocouDePerfil(perfilDaTela, ctx.profileId)) return { ok: false, error: MSG_TROCOU_DE_PERFIL };
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
    if (faturaTarget && item.installment?.confident) {
      // Um mês antes e um depois das parcelas também: é onde a parcela projetada por outra fatura
      // está quando o mês escolhido ficou um mês fora (ver `parcelaJaLancada`).
      for (let n = item.installment.current; n <= item.installment.total + 1; n += 1) {
        const d = new Date(ym.year, ym.month - 1 + (n - item.installment.current), 1);
        monthsInBatch.add(`${profileId}|${d.getFullYear()}/${d.getMonth() + 1}`);
      }
      const antes = shiftMonth(ym.year, ym.month, -1);
      monthsInBatch.add(`${profileId}|${antes.year}/${antes.month}`);
    }
  }
  // CONTAGEM, não presença: quem tem dois cafés iguais no mesmo dia (e escolheu manter os dois
  // na revisão) fica com os dois. Só é pulado o que já existe no banco, um a um.
  const existingCounts = new Map<string, number>();
  // Segunda chave, sem a descrição: mesma data + mesmo valor + mesmo tipo, só contra o que JÁ
  // veio de um arquivo. É o extrato da semana subido de novo no fim do mês (ou em outro formato,
  // CSV numa semana e PDF no mês), em que o banco escreve a mesma transação de outro jeito. Só
  // pula sozinho quando a descrição bate (ver lib/import/duplicata-solta); com descrição diferente
  // a revisão já perguntou "é o mesmo?", e o que ela manteve entra.
  const looseDescricoes = new Map<string, ExistenteSolto[]>();
  // Terceira, só pra parcela de fatura: mesma descrição (com o "N/T" normalizado) e valor com a
  // folga dos centavos (ver mesmaParcela). Sem ela, "PARC 02/03" de R$ 33,33 não batia com a
  // parcela 02/03 de R$ 33,34 que a fatura anterior já tinha lançado, e a compra duplicava.
  // Guarda o id e o lote de cada uma: a parcela que esta fatura confirma passa a ser dela (ver `adotar`).
  const parcelasExistentes = new Map<string, ParcelaExistente[]>();
  // Linha importada que ela renomeou ("Definir descrição" no Foco) é comparada pelo nome que o
  // banco deu: com o nome novo, a mesma fatura subida de novo entrava em dobro.
  // Todos os perfis dela: a linha que este perfil mandou pra outro também é comparada (ver abaixo).
  const nomesDoBanco = await descricoesOriginais(ctx, [...new Set([...[...monthsInBatch].map((k) => k.split("|")[0]), ...ownProfileIds])]);
  for (const key of monthsInBatch) {
    const [profileId, ym] = key.split("|");
    const [y, m] = ym.split("/").map(Number);
    const existing = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId, year: y, month: m },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, importBatchId: true },
    });
    for (const e of existing) {
      const dia = e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null;
      const descricao = nomesDoBanco.get(e.id) ?? e.description;
      const k = `${profileId}|${y}/${m}|${dedupeKey(dia, Number(e.amount), descricao)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      if (!dia && Number(e.amount) > 0 && parcelaCerta(descricao)) {
        const pk = `${profileId}|${y}/${m}|${descricaoComparavel(descricao)}`;
        parcelasExistentes.set(pk, [...(parcelasExistentes.get(pk) ?? []), { valor: Number(e.amount), id: e.id, loteId: e.importBatchId, mes: y * 12 + m }]);
      }
      if (dia && e.importBatchId) {
        const lk = `${profileId}|${chaveSoltaDe(dia, Number(e.amount), e.category)}`;
        looseDescricoes.set(lk, [...(looseDescricoes.get(lk) ?? []), { descricao }]);
      }
    }
  }
  // Linha que uma importação DESTE perfil mandou pra outro ("mandar pra Empresa" na revisão da
  // semana) conta como já lançada aqui também. O extrato do mês traz a mesma linha sem perfil, ela
  // vai pro ativo, e as chaves acima só olham o perfil de destino: a compra entrava de novo no
  // Pessoal, calada. Só a chave exata e a solta (a do extrato); a parcela de fatura continua como era.
  const outrosPerfis = [...ownProfileIds].filter((id) => id !== ctx.profileId);
  const mesesDoAtivo = [...monthsInBatch].flatMap((k) => {
    const [profileId, ym] = k.split("|");
    const [year, month] = ym.split("/").map(Number);
    return profileId === ctx.profileId ? [{ year, month }] : [];
  });
  if (outrosPerfis.length > 0 && mesesDoAtivo.length > 0) {
    const mandadas = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: { in: outrosPerfis }, importBatchId: { not: null }, importBatch: { is: { profileId: ctx.profileId } }, OR: mesesDoAtivo },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, year: true, month: true },
    });
    for (const e of mandadas) {
      const dia = e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null;
      const descricao = nomesDoBanco.get(e.id) ?? e.description;
      const k = `${ctx.profileId}|${e.year}/${e.month}|${dedupeKey(dia, Number(e.amount), descricao)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      if (dia) {
        const lk = `${ctx.profileId}|${chaveSoltaDe(dia, Number(e.amount), e.category)}`;
        looseDescricoes.set(lk, [...(looseDescricoes.get(lk) ?? []), { descricao }]);
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
  const adotar = async (id: string, profileId: string, mes: number) => {
    const r = await prisma.monthlyEntry.updateMany({ where: { id, userId: ctx.userId, profileId }, data: { importBatchId: batch.id } });
    adotados += r.count;
    // O mês em que a parcela ESTÁ (pode ser o vizinho do esperado, ver `parcelaJaLancada`).
    const year = Math.floor((mes - 1) / 12);
    if (r.count > 0) touchedMonths.add(`${year}/${mes - year * 12}`);
  };

  /** Já existe no banco uma cópia ainda não "gasta" desta chave? Consome uma e diz que sim. */
  const alreadyThere = (k: string) => {
    const left = existingCounts.get(k) ?? 0;
    if (left <= 0) return false;
    existingCounts.set(k, left - 1);
    return true;
  };
  /** Estorno e resgate são gravados negativos: a chave tem que usar o mesmo sinal que está no banco. */
  const valorGravado = (item: ConfirmedItem) =>
    (item.estorno && item.category === "EXPENSE") || (item.resgate && item.category === "INVESTMENT_CONTRIBUTION") ? -item.amount : item.amount;
  const chaveExata = (item: ConfirmedItem, valor = valorGravado(item)) => {
    const originalYm = yearMonthFromISO(item.date);
    const ym = faturaTarget ?? originalYm ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
    return `${profileIdOf(item)}|${ym.year}/${ym.month}|${dedupeKey(!faturaTarget && originalYm ? item.date : null, valor, item.description)}`;
  };
  /**
   * Crédito do extrato que ela já tinha marcado como ESTORNO numa importação anterior (gravado
   * como gasto negativo). O extrato do mês traz a mesma linha como renda de novo: a chave exata
   * compara o valor com sinal e a solta compara o tipo, então nenhuma batia e a devolução entrava
   * outra vez, agora como renda que não existe. Só o extrato, e só renda contra valor negativo:
   * valor negativo no banco é sempre estorno, nunca uma compra com a mesma descrição.
   */
  const jaLancadoComoEstorno = (item: ConfirmedItem) => !faturaTarget && item.category === "INCOME" && alreadyThere(chaveExata(item, -item.amount));
  /**
   * Já existe esta parcela (valor com folga de centavos)? Consome uma e devolve qual era.
   * Primeiro no mês certo; se não achar, a parcela que outra fatura PROJETOU no mês vizinho. É o
   * caso do mês escolhido um mês fora (o seletor começa no mês de hoje): setembro projetou a
   * 04/10 em outubro, a fatura de outubro foi lançada em novembro, e a 04/10 e as seguintes
   * ficavam todas em dobro. Só projeção no vizinho: parcela que veio de verdade numa fatura
   * daquele mês é de outra compra igual, não desta.
   */
  const parcelaJaLancada = (k: string, valor: number, total: number): ParcelaExistente | null => {
    const pegar = (chave: string, aceita: (p: ParcelaExistente) => boolean) => {
      const existentes = parcelasExistentes.get(chave) ?? [];
      const i = existentes.findIndex((p) => mesmaParcela(p.valor, valor, total) && aceita(p));
      return i === -1 ? null : existentes.splice(i, 1)[0];
    };
    const [profileId, ym, ...resto] = k.split("|");
    const [year, month] = ym.split("/").map(Number);
    const vizinho = (delta: number) => {
      const v = shiftMonth(year, month, delta);
      return [profileId, `${v.year}/${v.month}`, ...resto].join("|");
    };
    return pegar(k, () => true) ?? pegar(vizinho(-1), ehProjecao) ?? pegar(vizinho(1), ehProjecao);
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
    item.amount > 0 && !faturaTarget && yearMonthFromISO(item.date) ? `${profileIdOf(item)}|${chaveSoltaDe(item.date, valorGravado(item), item.category)}` : null;
  // Duas etapas: primeiro o que bate EXATO (mesma descrição), depois, só entre os que sobraram,
  // o que bate por data + valor com a descrição do mesmo jeito (ver casarPorDataEValor).
  const pular = new Set<number>();
  // Parcela pulada que era projeção de outro lote: índice → a parcela (ver `adotar`).
  const confirmadas = new Map<number, ParcelaExistente>();
  items.forEach((item, i) => {
    if (item.amount <= 0) return;
    const parcela = chaveParcela(item);
    const achada = parcela ? parcelaJaLancada(parcela.key, valorGravado(item), parcela.total) : null;
    if (achada && ehProjecao(achada)) confirmadas.set(i, achada);
    if (parcela ? achada !== null : alreadyThere(chaveExata(item)) || jaLancadoComoEstorno(item)) pular.add(i);
  });
  const soltas = casarPorDataEValor(items.map(chaveSolta), items.map((item) => item.description), looseDescricoes, { perguntar: false, jaCasados: pular });
  for (const [i, casamento] of soltas) if (casamento.tipo === "mesmo") pular.add(i);

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
        if (adotarDe && achada.loteId === adotarDe) await adotar(achada.id, profileId, achada.mes);
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
        pessoa: pessoaPara(profileId),
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
    // A personalizada que não existe no perfil de destino (a "Pet" da Pessoal numa linha mandada
    // pra Empresa) cai em Outros: sem isso o gasto era gravado sem categoria nenhuma e sumia de
    // todo orçamento. A tela já tira a personalizada ao mover; isto cobre o que escapar.
    const personalizadaDeOutroPerfil = item.category === "EXPENSE" && Boolean(item.customCategoryId) && !customCategoryId;
    const parentCategory: ParentCategory | undefined =
      !customCategoryId && item.parentCategory && PARENT_CATEGORY_VALUES.includes(item.parentCategory)
        ? item.parentCategory
        : personalizadaDeOutroPerfil
          ? "OUTROS"
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
        await adotar(confirmada.id, profileId, confirmada.mes);
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
      pessoa: pessoaPara(profileId),
    });
    created += 1;
    touchedMonths.add(`${ym.year}/${ym.month}`);

    await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, null);

    // Aprende a classificação só para gastos com categoria definida pelo usuário.
    // O Outros de reserva (personalizada de outro perfil) não foi escolha dela: não vira regra.
    if (item.learn && item.category === "EXPENSE" && parentCategory && !personalizadaDeOutroPerfil) {
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
