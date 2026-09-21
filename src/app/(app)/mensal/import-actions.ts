"use server";

import { revalidatePath } from "next/cache";
import { installmentDescription, parseInstallment } from "@/lib/entries/recurrence";
import { countMoneyLines, detectInvoiceTotal, looksLikeCardInvoice, type DocKind } from "@/lib/import/detect";
import { profileDocument } from "@/lib/import/profile";
import { checarPlausibilidade, type Suspeita } from "@/lib/import/plausibility";
import { isPartialRead, mensagemImplausivel, recordImportDiagnostic, safeHeader } from "@/lib/repositories/import-diagnostic.repo";
import { storeFailedImportFile } from "@/lib/repositories/import-file.repo";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import {
  createImportBatch,
  deleteEmptyImportBatch,
  deleteImportBatchWithEntries,
} from "@/lib/repositories/import-batch.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatement, type ParsedTransaction } from "@/lib/import/statement-parser";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { pdfTextQuality } from "@/lib/import/pdf-quality";
import { classify, normalizeMerchant, type LearnedRule } from "@/lib/import/classify";

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

/**
 * Linhas de RESUMO da fatura de cartão: "pagamento efetuado/recebido" (o que o cliente já pagou
 * da fatura anterior) e "total de compras/créditos/pagamentos" (somatório que a própria fatura
 * já detalha item a item). Não são uma compra — importar essas linhas dobra o gasto ou lança
 * um "gasto" que na verdade é o pagamento da fatura.
 */
const FATURA_SUMMARY_RE = /\b(pagamentos?\s+(efetuado|recebido|realizado|de\s+fatura)|total\s+de\s+(cr[eé]ditos?|compras|pagamentos?|despesas))\b/i;

/** Testa a linha inteira (descrição E data) contra o padrão de resumo: faturas com várias
 * seções (pagamentos/créditos/compras) repetem o cabeçalho de coluna, e o subtotal entre
 * seções acaba caindo na coluna de data (ex.: BTG), não na de descrição. */
function isFaturaSummaryLine(txn: ParsedTransaction): boolean {
  return FATURA_SUMMARY_RE.test(txn.description) || FATURA_SUMMARY_RE.test(txn.date);
}

export type ReviewItem = {
  /** Chave estável no cliente (índice na lista original). */
  key: number;
  date: string;
  description: string;
  /** Sempre positivo aqui; o sinal virou `category`. */
  amount: number;
  category: "INCOME" | "EXPENSE";
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
  if (detectedKind !== "fatura" && looksLikeCardInvoice(parsedRaw)) detectedKind = "fatura";
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

  const items: ReviewItem[] = parsed.map((txn, index) => {
    // Fatura de cartão: compras vêm POSITIVAS (convenção oposta ao extrato bancário) e
    // pagamentos/estornos/cancelamentos vêm NEGATIVOS — confirmado com fatura real (BTG).
    // Sem essa inversão, um estorno/cancelamento (crédito de verdade) virava gasto em dobro.
    const isExpense = docType === "fatura" ? txn.amount > 0 : txn.amount < 0;
    // Só faz sentido categorizar saídas; entradas viram INCOME sem categoria-mãe.
    const classification = isExpense ? classify(txn.description, learned) : null;
    return {
      key: index,
      date: txn.date,
      description: txn.description,
      amount: Math.abs(txn.amount),
      category: isExpense ? "EXPENSE" : "INCOME",
      parentCategory: classification?.parentCategory ?? null,
      customCategoryId: null,
      subcategory: classification?.subcategory ?? null,
      autoClassified: classification !== null,
      installment: docType === "fatura" ? parseInstallment(txn.description) : null,
      fileRepeat: (() => {
        const k = dedupeKey(txn.date, Math.abs(txn.amount), txn.description);
        const total = repeatCount.get(k) ?? 1;
        return total > 1 ? { key: k, total } : null;
      })(),
    };
  });

  const stats: ParseStats = {
    detectedKind,
    detectedReason: profile.reason,
    summary: profile.summary,
    moneyLines,
    parsed: items.length,
    invoiceTotal: docType === "fatura" ? detectInvoiceTotal(text) : null,
    sumExpense: items.filter((i) => i.category === "EXPENSE").reduce((s, i) => s + i.amount, 0),
    sumIncome: items.filter((i) => i.category === "INCOME").reduce((s, i) => s + i.amount, 0),
    suspeitas: checarPlausibilidade(parsed, docType),
  };
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
  category: "INCOME" | "EXPENSE";
  parentCategory: ParentCategory | null;
  /** Categoria personalizada (quando a pessoa escolheu/criou uma na revisão). */
  customCategoryId: string | null;
  subcategory: string | null;
  /** true quando o usuário definiu/ajustou a categoria na revisão, vira regra aprendida. */
  learn: boolean;
  installment?: { current: number; total: number; confident: boolean } | null;
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
async function findCardPaymentCandidates(userId: string, year: number, month: number): Promise<CardPaymentCandidate[]> {
  const months = [shiftMonth(year, month, -1), { year, month }, shiftMonth(year, month, 1)];
  const candidates = await prisma.monthlyEntry.findMany({
    where: { userId, category: "EXPENSE", OR: months },
    select: { id: true, description: true, amount: true, entryDate: true },
    orderBy: { entryDate: "asc" },
  });
  return candidates
    .filter((c) => looksLikeCardPayment(c.description))
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

/** Chave de duplicata: mesma data + valor + descrição = mesma transação do extrato. */
function dedupeKey(date: string | null, amount: number, description: string | null): string {
  return `${date ?? ""}|${amount.toFixed(2)}|${(description ?? "").trim().toLowerCase()}`;
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

  // Só aceita customCategoryId que seja REALMENTE do usuário (evita linkar categoria de outra conta).
  const ownCustomIds = new Set((await listCustomCategories(ctx)).map((c) => c.id));

  // Meses afetados pela importação → busca os lançamentos existentes deles de uma vez. Entram
  // também os meses das PARCELAS futuras: sem eles, subir a fatura de outubro recriava as
  // parcelas que a fatura de setembro já tinha lançado, e a cada mês sobrava mais uma cópia.
  const monthOf = (item: ConfirmedItem) =>
    faturaTarget ?? yearMonthFromISO(item.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
  const monthsInBatch = new Set<string>();
  for (const item of items) {
    const ym = monthOf(item);
    monthsInBatch.add(`${ym.year}/${ym.month}`);
    if (faturaTarget && item.installment?.confident && item.installment.current < item.installment.total) {
      for (let n = item.installment.current + 1; n <= item.installment.total; n += 1) {
        const d = new Date(ym.year, ym.month - 1 + (n - item.installment.current), 1);
        monthsInBatch.add(`${d.getFullYear()}/${d.getMonth() + 1}`);
      }
    }
  }
  // CONTAGEM, não presença: quem tem dois cafés iguais no mesmo dia (e escolheu manter os dois
  // na revisão) fica com os dois. Só é pulado o que já existe no banco, um a um.
  const existingCounts = new Map<string, number>();
  for (const key of monthsInBatch) {
    const [y, m] = key.split("/").map(Number);
    const existing = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: y, month: m },
      select: { entryDate: true, amount: true, description: true },
    });
    for (const e of existing) {
      const k = `${y}/${m}|${dedupeKey(e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null, Number(e.amount), e.description)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
    }
  }
  /** Já existe no banco uma cópia ainda não "gasta" desta chave? Consome uma e diz que sim. */
  const alreadyThere = (k: string) => {
    const left = existingCounts.get(k) ?? 0;
    if (left <= 0) return false;
    existingCounts.set(k, left - 1);
    return true;
  };

  for (const item of items) {
    if (item.amount <= 0) continue;
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
    const key = `${ym.year}/${ym.month}|${dedupeKey(!faturaTarget && originalYm ? item.date : null, item.amount, item.description)}`;
    if (alreadyThere(key)) {
      skipped += 1;
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
      amount: item.amount,
      // Fatura: sem dia específico (lança "no mês", não "no dia da compra"). Extrato: mantém a
      // data exata de cada transação, como sempre foi.
      entryDate: !faturaTarget && originalYm ? new Date(`${item.date}T12:00:00`) : undefined,
      importBatchId: batch.id,
    });
    created += 1;
    touchedMonths.add(`${ym.year}/${ym.month}`);

    // Compra parcelada: as parcelas que ainda vêm entram nos meses seguintes, no mesmo lote
    // (desfazer o lote leva todas). "03/10" em setembro vira 04/10 em outubro… até 10/10.
    // `confident`: "POSTO SHELL 03/09" é data de compra, não parcela 3 de 9 — sem essa checagem
    // o app inventava seis gastos nos meses seguintes.
    if (faturaTarget && item.installment?.confident && item.installment.current < item.installment.total) {
      const { current, total } = item.installment;
      for (let n = current + 1; n <= total; n += 1) {
        const offset = n - current;
        const d = new Date(ym.year, ym.month - 1 + offset, 1);
        const desc = installmentDescription(item.description, n, total);
        const futureKey = `${d.getFullYear()}/${d.getMonth() + 1}|${dedupeKey(null, item.amount, desc)}`;
        if (alreadyThere(futureKey)) continue;
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
        });
        created += 1;
        touchedMonths.add(`${d.getFullYear()}/${d.getMonth() + 1}`);
      }
    }

    // Aprende a classificação só para gastos com categoria definida pelo usuário.
    if (item.learn && item.category === "EXPENSE" && parentCategory) {
      const pattern = normalizeMerchant(item.description);
      if (pattern) {
        await upsertTransactionRule(ctx, { pattern, parentCategory, subcategory: item.subcategory ?? undefined });
      }
    }
  }

  // Upload que só tinha duplicata não criou nada: não polui o histórico com lote vazio.
  if (created === 0) await deleteEmptyImportBatch(ctx, batch.id);

  // Fatura: lista candidatos a "pagamento de fatura" no extrato pra pessoa decidir se remove
  // (evita contar em dobro), sem apagar nada sozinho.
  const cardPaymentCandidates =
    faturaTarget && created > 0 ? await findCardPaymentCandidates(ctx.userId, faturaTarget.year, faturaTarget.month) : [];

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
