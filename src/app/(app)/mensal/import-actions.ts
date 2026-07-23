"use server";

import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatement } from "@/lib/import/statement-parser";
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

  const parsed = parseStatement(text, source);
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
    // Fatura de cartão: toda linha é compra (gasto), independentemente do sinal, resolve o
    // caso em que as compras vinham positivas e eram lidas como renda. Extrato: sinal manda.
    const isExpense = docType === "fatura" ? true : txn.amount < 0;
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

export type ImportResult =
  | { ok: true; created: number; skipped: number; removedCardPayment?: { description: string; amount: number } | null }
  | { ok: false; error: string };

/** Reconhece a linha de "pagamento de fatura de cartão" que vem no EXTRATO bancário. */
const CARD_PAYMENT_RE = /fatura/i;
function looksLikeCardPayment(description: string | null): boolean {
  const d = (description ?? "").toLowerCase();
  return CARD_PAYMENT_RE.test(d) && (/pagament/.test(d) || /cart[aã]o/.test(d));
}

/**
 * Quando a pessoa importa a FATURA detalhada, procura no extrato já lançado a linha única de
 * "pagamento de fatura" (mesmo gasto, agregado) com valor próximo ao total das compras e a
 * remove, evita contar o gasto duas vezes. Busca no mês das compras e no mês seguinte (a
 * fatura costuma ser paga depois). Só remove com correspondência de valor confiante.
 */
async function removeMatchingCardPayment(
  userId: string,
  touchedMonths: Set<string>,
  purchasesTotal: number,
): Promise<{ description: string; amount: number } | null> {
  const monthKeys = new Set<string>();
  for (const key of touchedMonths) {
    const [y, m] = key.split("/").map(Number);
    monthKeys.add(`${y}/${m}`);
    const next = new Date(y, m, 1); // m já é 1-based → Date(y, m) = mês seguinte
    monthKeys.add(`${next.getFullYear()}/${next.getMonth() + 1}`);
  }
  const where = [...monthKeys].map((k) => {
    const [y, m] = k.split("/").map(Number);
    return { year: y, month: m };
  });

  const candidates = await prisma.monthlyEntry.findMany({
    where: { userId, category: "EXPENSE", OR: where },
    select: { id: true, description: true, amount: true },
  });

  const tolerance = Math.max(50, purchasesTotal * 0.05);
  const match = candidates
    .filter((c) => looksLikeCardPayment(c.description))
    .map((c) => ({ c, diff: Math.abs(Number(c.amount) - purchasesTotal) }))
    .filter((x) => x.diff <= tolerance)
    .sort((a, b) => a.diff - b.diff)[0];

  if (!match) return null;
  await prisma.monthlyEntry.delete({ where: { id: match.c.id } });
  return { description: match.c.description ?? "Pagamento de fatura", amount: Number(match.c.amount) };
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

/** Cria os lançamentos escolhidos e memoriza as categorias definidas manualmente (item 3).
 * Transações idênticas já lançadas (mesma data+valor+descrição) são puladas, importar o
 * mesmo extrato duas vezes não duplica nada. */
export async function importTransactionsAction(
  items: ConfirmedItem[],
  docType: "extrato" | "fatura" = "extrato",
): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  const now = new Date();
  const touchedMonths = new Set<string>();
  let created = 0;
  let skipped = 0;
  let purchasesTotal = 0;

  // Só aceita customCategoryId que seja REALMENTE do usuário (evita linkar categoria de outra conta).
  const ownCustomIds = new Set((await listCustomCategories(ctx)).map((c) => c.id));

  // Meses afetados pela importação → busca os lançamentos existentes deles de uma vez.
  const monthsInBatch = new Set(
    items.map((i) => {
      const ym = yearMonthFromISO(i.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
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

    // Data inválida cai no mês corrente, melhor lançar do que perder a transação.
    const ym = yearMonthFromISO(item.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
    const hasExactDate = yearMonthFromISO(item.date) !== null;

    const key = dedupeKey(hasExactDate ? item.date : null, item.amount, item.description);
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
      entryDate: hasExactDate ? new Date(`${item.date}T12:00:00`) : undefined,
    });
    created += 1;
    purchasesTotal += item.amount;
    touchedMonths.add(`${ym.year}/${ym.month}`);

    // Aprende a classificação só para gastos com categoria definida pelo usuário.
    if (item.learn && item.category === "EXPENSE" && parentCategory) {
      const pattern = normalizeMerchant(item.description);
      if (pattern) {
        await upsertTransactionRule(ctx, { pattern, parentCategory, subcategory: item.subcategory ?? undefined });
      }
    }
  }

  // Fatura: remove o "pagamento de fatura" que veio do extrato, pra não contar em dobro.
  const removedCardPayment =
    docType === "fatura" && created > 0 ? await removeMatchingCardPayment(ctx.userId, touchedMonths, purchasesTotal) : null;

  for (const key of touchedMonths) {
    const [year, month] = key.split("/");
    revalidatePath(`/mensal/${year}`);
    revalidatePath(`/mensal/${year}/${month}`);
  }

  return { ok: true, created, skipped, removedCardPayment };
}
