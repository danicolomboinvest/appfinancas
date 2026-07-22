"use server";

import type { Prisma } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type CategoryTransaction = {
  id: string;
  description: string;
  /** "YYYY-MM-DD" quando há data da despesa; senão null. */
  date: string | null;
  amount: number;
};

export type CategoryRef =
  | { kind: "parent"; value: string }
  | { kind: "custom"; value: string };

/**
 * Lista os lançamentos (gastos) de uma categoria dentro do período selecionado na tela "Só
 * gastos", alimenta o clique na fatia/legenda da pizza, que expande pra mostrar o que compõe
 * aquele valor. Semana usa a data de lançamento (createdAt); mês/ano usam year/month.
 */
export async function getCategoryTransactionsAction(
  period: "semana" | "mes" | "ano",
  year: number,
  month: number,
  category: CategoryRef,
): Promise<CategoryTransaction[]> {
  const ctx = await getRequiredSession();

  const categoryWhere: Prisma.MonthlyEntryWhereInput =
    category.kind === "parent" ? { parentCategory: category.value as never } : { customCategoryId: category.value };

  let periodWhere: Prisma.MonthlyEntryWhereInput;
  if (period === "semana") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    periodWhere = { createdAt: { gte: weekAgo } };
  } else if (period === "ano") {
    periodWhere = { year };
  } else {
    periodWhere = { year, month };
  }

  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, category: "EXPENSE", ...categoryWhere, ...periodWhere },
    select: { id: true, description: true, subcategory: true, amount: true, entryDate: true, createdAt: true },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return entries.map((e) => ({
    id: e.id,
    description: e.description || e.subcategory || "Lançamento",
    date: e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null,
    amount: Number(e.amount),
  }));
}
