import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";

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

/**
 * Aplica o mesmo valor planejado aos 12 meses do ano de uma categoria (upsert em massa) —
 * usado pela tela de planejamento (/orcamento), onde o usuário define um valor mensal único
 * em vez de editar mês a mês. Editar um mês específico depois continua possível em
 * /mensal/[year]/[month] (upsertBudget), sem conflito — é a mesma tabela.
 */
export async function applyBudgetToWholeYear(
  ctx: AuthContext,
  input: { year: number; parentCategory: ParentCategory; plannedAmount: number },
): Promise<void> {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  await prisma.$transaction(
    months.map((month) =>
      prisma.budget.upsert({
        where: {
          userId_year_month_parentCategory: {
            userId: ctx.userId,
            year: input.year,
            month,
            parentCategory: input.parentCategory,
          },
        },
        create: { ...input, month, userId: ctx.userId },
        update: { plannedAmount: input.plannedAmount },
      }),
    ),
  );
}

/**
 * Valor "atual" de planejamento por categoria para a tela /orcamento — usa o mês corrente
 * (ou janeiro, se `year` for um ano diferente do atual) como referência, já que os 12 meses
 * podem ter divergido entre si se o usuário editou um mês específico depois de aplicar o
 * plano anual.
 */
export async function getAnnualBudgetPlan(ctx: AuthContext, year: number): Promise<Record<ParentCategory, number>> {
  const now = new Date();
  const referenceMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const budgets = await prisma.budget.findMany({ where: { userId: ctx.userId, year, month: referenceMonth } });
  const byCategory = new Map(budgets.map((b) => [b.parentCategory, Number(b.plannedAmount)]));
  return Object.fromEntries(PARENT_CATEGORIES.map((pc) => [pc, byCategory.get(pc) ?? 0])) as Record<
    ParentCategory,
    number
  >;
}

/** Todos os orçamentos do ano (sem filtro de mês) — alimenta o comparativo planejado x realizado. */
export async function listBudgetsForYear(ctx: AuthContext, year: number) {
  return prisma.budget.findMany({ where: { userId: ctx.userId, year } });
}

/** Soma de gastos (EXPENSE) do ano inteiro, agrupada por mês + categoria-mãe. */
export async function sumExpensesByParentCategoryForYear(ctx: AuthContext, year: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["month", "parentCategory"],
    where: { userId: ctx.userId, year, category: "EXPENSE", parentCategory: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    month: g.month,
    parentCategory: g.parentCategory as ParentCategory,
    spent: Number(g._sum.amount ?? 0),
  }));
}
