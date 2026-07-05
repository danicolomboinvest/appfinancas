import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export async function listBudgets(ctx: AuthContext, year: number, month: number) {
  return prisma.budget.findMany({ where: { userId: ctx.userId, year, month } });
}

/** Cria ou atualiza o orçamento de uma categoria-mãe para o mês (upsert por chave única). */
export async function upsertBudget(
  ctx: AuthContext,
  input: { year: number; month: number; parentCategory: ParentCategory; plannedAmount: number },
) {
  return prisma.budget.upsert({
    where: {
      userId_year_month_parentCategory: {
        userId: ctx.userId,
        year: input.year,
        month: input.month,
        parentCategory: input.parentCategory,
      },
    },
    create: { ...input, userId: ctx.userId },
    update: { plannedAmount: input.plannedAmount },
  });
}

/** Soma de gastos (EXPENSE) do mês, agrupada por categoria-mãe. */
export async function sumExpensesByParentCategory(ctx: AuthContext, year: number, month: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory"],
    where: { userId: ctx.userId, year, month, category: "EXPENSE", parentCategory: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    parentCategory: g.parentCategory as ParentCategory,
    spent: Number(g._sum.amount ?? 0),
  }));
}
