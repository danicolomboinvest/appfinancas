import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";

export async function listBudgets(ctx: AuthContext, year: number, month: number) {
  return prisma.budget.findMany({ where: { userId: ctx.userId, year, month } });
}

/**
 * Cria ou atualiza o orçamento de uma categoria-mãe para o mês. Não dá pra usar o atalho
 * `where` de chave composta do Prisma aqui — o tipo gerado pra chaves compostas exige valores
 * não-nulos em todos os campos, mesmo quando a coluna (`customCategoryId`) é opcional — então
 * fazemos o find-then-create-or-update manualmente.
 */
export async function upsertBudget(
  ctx: AuthContext,
  input: { year: number; month: number; parentCategory: ParentCategory; plannedAmount: number },
) {
  const existing = await prisma.budget.findFirst({
    where: { userId: ctx.userId, year: input.year, month: input.month, parentCategory: input.parentCategory },
  });
  if (existing) {
    return prisma.budget.update({ where: { id: existing.id }, data: { plannedAmount: input.plannedAmount } });
  }
  return prisma.budget.create({ data: { ...input, userId: ctx.userId } });
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
  const existing = await prisma.budget.findMany({
    where: { userId: ctx.userId, year: input.year, parentCategory: input.parentCategory },
  });
  const existingByMonth = new Map(existing.map((b) => [b.month, b.id]));
  await prisma.$transaction(
    months.map((month) => {
      const existingId = existingByMonth.get(month);
      return existingId
        ? prisma.budget.update({ where: { id: existingId }, data: { plannedAmount: input.plannedAmount } })
        : prisma.budget.create({ data: { ...input, month, userId: ctx.userId } });
    }),
  );
}

/** Mesma coisa que applyBudgetToWholeYear, só que pra uma categoria personalizada (por id). */
export async function applyBudgetToWholeYearForCustomCategory(
  ctx: AuthContext,
  input: { year: number; customCategoryId: string; plannedAmount: number },
): Promise<void> {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const existing = await prisma.budget.findMany({
    where: { userId: ctx.userId, year: input.year, customCategoryId: input.customCategoryId },
  });
  const existingByMonth = new Map(existing.map((b) => [b.month, b.id]));
  await prisma.$transaction(
    months.map((month) => {
      const existingId = existingByMonth.get(month);
      return existingId
        ? prisma.budget.update({ where: { id: existingId }, data: { plannedAmount: input.plannedAmount } })
        : prisma.budget.create({
            data: {
              year: input.year,
              month,
              plannedAmount: input.plannedAmount,
              customCategoryId: input.customCategoryId,
              userId: ctx.userId,
            },
          });
    }),
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
  const budgets = await prisma.budget.findMany({
    where: { userId: ctx.userId, year, month: referenceMonth, parentCategory: { not: null } },
  });
  const byCategory = new Map(budgets.map((b) => [b.parentCategory, Number(b.plannedAmount)]));
  return Object.fromEntries(PARENT_CATEGORIES.map((pc) => [pc, byCategory.get(pc) ?? 0])) as Record<
    ParentCategory,
    number
  >;
}

/** Mesma referência de mês de getAnnualBudgetPlan, só que pras categorias personalizadas do usuário. */
export async function getAnnualBudgetPlanForCustomCategories(
  ctx: AuthContext,
  year: number,
  customCategoryIds: string[],
): Promise<Record<string, number>> {
  if (customCategoryIds.length === 0) return {};
  const now = new Date();
  const referenceMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const budgets = await prisma.budget.findMany({
    where: { userId: ctx.userId, year, month: referenceMonth, customCategoryId: { in: customCategoryIds } },
  });
  const byCategory = new Map(budgets.map((b) => [b.customCategoryId, Number(b.plannedAmount)]));
  return Object.fromEntries(customCategoryIds.map((id) => [id, byCategory.get(id) ?? 0]));
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

/** Soma de gastos por categoria-mãe lançados a partir de uma data (por createdAt) — usado na
 * visão "semana" da tela Só gastos, já que o lançamento guarda só ano/mês, não o dia da despesa. */
export async function sumExpensesByParentCategorySince(ctx: AuthContext, since: Date) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory"],
    where: { userId: ctx.userId, category: "EXPENSE", parentCategory: { not: null }, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    parentCategory: g.parentCategory as ParentCategory,
    spent: Number(g._sum.amount ?? 0),
  }));
}

/** Igual à de cima, mas por categoria personalizada. */
export async function sumExpensesByCustomCategorySince(ctx: AuthContext, since: Date) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["customCategoryId"],
    where: { userId: ctx.userId, category: "EXPENSE", customCategoryId: { not: null }, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    customCategoryId: g.customCategoryId as string,
    spent: Number(g._sum.amount ?? 0),
  }));
}

/** Soma de gastos (EXPENSE) do mês, agrupada por categoria personalizada. */
export async function sumExpensesByCustomCategory(ctx: AuthContext, year: number, month: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["customCategoryId"],
    where: { userId: ctx.userId, year, month, category: "EXPENSE", customCategoryId: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    customCategoryId: g.customCategoryId as string,
    spent: Number(g._sum.amount ?? 0),
  }));
}

/** Mesma coisa que sumExpensesByParentCategoryForYear, só que agrupada por categoria personalizada. */
export async function sumExpensesByCustomCategoryForYear(ctx: AuthContext, year: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["month", "customCategoryId"],
    where: { userId: ctx.userId, year, category: "EXPENSE", customCategoryId: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    month: g.month,
    customCategoryId: g.customCategoryId as string,
    spent: Number(g._sum.amount ?? 0),
  }));
}
