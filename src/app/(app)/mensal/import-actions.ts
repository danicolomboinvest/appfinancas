"use server";

import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatement, type ParsedTransaction } from "@/lib/import/statement-parser";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { classify, normalizeMerchant, type LearnedRule } from "@/lib/import/classify";

const PARENT_CATEGORY_VALUES: ParentCategory[] = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "FINANCEIRO",
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
};

export type ParseStatementResult =
  | { ok: true; items: ReviewItem[]; customCategories: { id: string; name: string }[] }
  | { ok: false; error: string; needsPassword?: boolean };

/** Lê o extrato (CSV/OFX/Excel/PDF), classifica cada transação e devolve a fila pra revisão.
 * O arquivo vem CRU num FormData ({ file, encoding }), string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
export async function parseStatementAction(formData: FormData): Promise<ParseStatementResult> {
  const ctx = await getRequiredSession();
  const encoding = String(formData.get("encoding") ?? "text");
  // "fatura" = fatura de cartão (tudo é gasto); "extrato" = extrato bancário (sinal manda).
  const docType = String(formData.get("docType") ?? "extrato");

  let text: string;
  let source: "auto" | "pdf";
  try {
    ({ text, source } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof PasswordRequiredError) return { ok: false, error: err.message, needsPassword: true };
    if (err instanceof UploadReadError) return { ok: false, error: err.message };
    throw err;
  }

  // PDF escaneado/foto não tem texto extraível, avisa e pede Excel, em vez de erro genérico.
  const readableChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (encoding === "pdf" && readableChars < 12) {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF, ele parece ser escaneado ou uma foto. Exporte o extrato em Excel (.xlsx), CSV ou OFX que aí funciona.",
    };
  }

  const parsedRaw = parseStatement(text, source);
  // Fatura: linhas de RESUMO ("pagamento efetuado", "total de compras", "total de crédito
  // recebido") são agregados que a própria fatura já detalha em outras linhas — não são uma
  // compra a mais. Sem isso, o "pagamento de fatura" virava um gasto extra na revisão.
  const parsed = docType === "fatura" ? parsedRaw.filter((txn) => !isFaturaSummaryLine(txn)) : parsedRaw;
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "Não encontrei transações nesse arquivo. Se for um PDF escaneado/foto, exporte em Excel (.xlsx) ou CSV, costuma ler melhor.",
    };
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
    };
  });

  return { ok: true, items, customCategories: customCategories.map((c) => ({ id: c.id, name: c.name })) };
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
  const result = await prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId } });
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
): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  const now = new Date();
  const touchedMonths = new Set<string>();
  let created = 0;
  let skipped = 0;

  const faturaTarget =
    docType === "fatura" && targetYear && targetMonth ? { year: targetYear, month: targetMonth } : null;

  // Só aceita customCategoryId que seja REALMENTE do usuário (evita linkar categoria de outra conta).
  const ownCustomIds = new Set((await listCustomCategories(ctx)).map((c) => c.id));

  // Meses afetados pela importação → busca os lançamentos existentes deles de uma vez.
  const monthsInBatch = new Set(
    items.map((i) => {
      const ym = faturaTarget ?? yearMonthFromISO(i.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
      return `${ym.year}/${ym.month}`;
    }),
  );
  const existingKeys = new Set<string>();
  for (const key of monthsInBatch) {
    const [y, m] = key.split("/").map(Number);
    const existing = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, year: y, month: m },
      select: { entryDate: true, amount: true, description: true },
    });
    for (const e of existing) {
      existingKeys.add(dedupeKey(e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null, Number(e.amount), e.description));
    }
  }

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
    // A duplicata é checada pela data ORIGINAL da compra (não a escolhida pra fatura): uma
    // assinatura recorrente (mesma descrição+valor em meses diferentes) não pode ser confundida
    // com a mesma transação re-importada.
    const key = dedupeKey(originalYm ? item.date : null, item.amount, item.description);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key); // também evita duplicata dentro do próprio arquivo

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
    });
    created += 1;
    touchedMonths.add(`${ym.year}/${ym.month}`);

    // Aprende a classificação só para gastos com categoria definida pelo usuário.
    if (item.learn && item.category === "EXPENSE" && parentCategory) {
      const pattern = normalizeMerchant(item.description);
      if (pattern) {
        await upsertTransactionRule(ctx, { pattern, parentCategory, subcategory: item.subcategory ?? undefined });
      }
    }
  }

  // Fatura: lista candidatos a "pagamento de fatura" no extrato pra pessoa decidir se remove
  // (evita contar em dobro), sem apagar nada sozinho.
  const cardPaymentCandidates =
    faturaTarget && created > 0 ? await findCardPaymentCandidates(ctx.userId, faturaTarget.year, faturaTarget.month) : [];

  for (const key of touchedMonths) {
    const [year, month] = key.split("/");
    revalidatePath(`/mensal/${year}`);
    revalidatePath(`/mensal/${year}/${month}`);
  }

  return { ok: true, created, skipped, cardPaymentCandidates };
}
