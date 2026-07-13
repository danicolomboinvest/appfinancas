"use server";

import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatement } from "@/lib/import/statement-parser";
import { extractUploadText, UploadReadError, type UploadEncoding } from "@/lib/import/extract-text";
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
  subcategory: string | null;
  /** true = classificado automaticamente; false = precisa de revisão manual (categoria vazia). */
  autoClassified: boolean;
};

export type ParseStatementResult = { ok: true; items: ReviewItem[] } | { ok: false; error: string };

/** Lê o extrato (CSV/OFX/Excel/PDF), classifica cada transação e devolve a fila pra revisão.
 * `content` é texto puro (CSV/OFX) ou base64 (Excel/PDF), conforme `encoding`. */
export async function parseStatementAction(
  content: string,
  encoding: UploadEncoding = "text",
): Promise<ParseStatementResult> {
  const ctx = await getRequiredSession();

  let text: string;
  let source: "auto" | "pdf";
  try {
    ({ text, source } = await extractUploadText(content, encoding));
  } catch (err) {
    if (err instanceof UploadReadError) return { ok: false, error: err.message };
    throw err;
  }

  // PDF escaneado/foto não tem texto extraível — avisa e pede Excel, em vez de erro genérico.
  const readableChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (encoding === "pdf" && readableChars < 12) {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF — ele parece ser escaneado ou uma foto. Exporte o extrato em Excel (.xlsx), CSV ou OFX que aí funciona.",
    };
  }

  const parsed = parseStatement(text, source);
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "Não encontrei transações nesse arquivo. Se for um PDF escaneado/foto, exporte em Excel (.xlsx) ou CSV — costuma ler melhor.",
    };
  }

  const rules = await listTransactionRules(ctx);
  const learned: LearnedRule[] = rules.map((r) => ({
    pattern: r.pattern,
    parentCategory: r.parentCategory,
    subcategory: r.subcategory ?? undefined,
  }));

  const items: ReviewItem[] = parsed.map((txn, index) => {
    const isExpense = txn.amount < 0;
    // Só faz sentido categorizar saídas; entradas viram INCOME sem categoria-mãe.
    const classification = isExpense ? classify(txn.description, learned) : null;
    return {
      key: index,
      date: txn.date,
      description: txn.description,
      amount: Math.abs(txn.amount),
      category: isExpense ? "EXPENSE" : "INCOME",
      parentCategory: classification?.parentCategory ?? null,
      subcategory: classification?.subcategory ?? null,
      autoClassified: classification !== null,
    };
  });

  return { ok: true, items };
}

export type ConfirmedItem = {
  date: string;
  description: string;
  amount: number;
  category: "INCOME" | "EXPENSE";
  parentCategory: ParentCategory | null;
  subcategory: string | null;
  /** true quando o usuário definiu/ajustou a categoria na revisão — vira regra aprendida. */
  learn: boolean;
};

export type ImportResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

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
 * Transações idênticas já lançadas (mesma data+valor+descrição) são puladas — importar o
 * mesmo extrato duas vezes não duplica nada. */
export async function importTransactionsAction(items: ConfirmedItem[]): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  const now = new Date();
  const touchedMonths = new Set<string>();
  let created = 0;
  let skipped = 0;

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
    const parentCategory =
      item.parentCategory && PARENT_CATEGORY_VALUES.includes(item.parentCategory) ? item.parentCategory : undefined;

    // Data inválida cai no mês corrente — melhor lançar do que perder a transação.
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
      subcategory: item.subcategory ?? undefined,
      description: item.description,
      amount: item.amount,
      entryDate: hasExactDate ? new Date(`${item.date}T12:00:00`) : undefined,
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

  for (const key of touchedMonths) {
    const [year, month] = key.split("/");
    revalidatePath(`/mensal/${year}`);
    revalidatePath(`/mensal/${year}/${month}`);
  }

  return { ok: true, created, skipped };
}
