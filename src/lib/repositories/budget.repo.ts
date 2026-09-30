import type { ParentCategory } from "@prisma/client";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { mesesQueOSalvarGrava } from "@/lib/planning/plano-anual";

export async function listBudgets(ctx: AuthContext, year: number, month: number) {
  return prisma.budget.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, year, month } });
}

/**
 * Cria ou atualiza o orçamento de uma categoria-mãe para o mês. Não dá pra usar o atalho
 * `where` de chave composta do Prisma aqui, o tipo gerado pra chaves compostas exige valores
 * não-nulos em todos os campos, mesmo quando a coluna (`customCategoryId`) é opcional, então
 * fazemos o find-then-create-or-update manualmente.
 */
export async function upsertBudget(
  ctx: AuthContext,
  input: { year: number; month: number; parentCategory: ParentCategory; plannedAmount: number },
) {
  const existing = await prisma.budget.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, year: input.year, month: input.month, parentCategory: input.parentCategory },
  });
  if (existing) {
    return prisma.budget.update({ where: { id: existing.id }, data: { plannedAmount: input.plannedAmount } });
  }
  return prisma.budget.create({ data: { ...input, userId: ctx.userId, profileId: ctx.profileId } });
}

/** Soma de gastos (EXPENSE) do mês, agrupada por categoria-mãe. */
export async function sumExpensesByParentCategory(ctx: AuthContext, year: number, month: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "EXPENSE", parentCategory: { not: null } },
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
 * /mensal/[year]/[month] (upsertBudget), sem conflito, é a mesma tabela.
 */
export async function applyBudgetToWholeYear(
  ctx: AuthContext,
  input: { year: number; parentCategory: ParentCategory; plannedAmount: number },
): Promise<void> {
  const months = monthsToApply(input.year);
  const existing = await prisma.budget.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year: input.year, parentCategory: input.parentCategory },
  });
  const existingByMonth = new Map(existing.map((b) => [b.month, b.id]));
  await prisma.$transaction(
    months.map((month) => {
      const existingId = existingByMonth.get(month);
      return existingId
        ? prisma.budget.update({ where: { id: existingId }, data: { plannedAmount: input.plannedAmount } })
        : prisma.budget.create({ data: { ...input, month, userId: ctx.userId, profileId: ctx.profileId } });
    }),
  );
}

/**
 * Meses que um "salvar tudo" pode tocar (regra em plano-anual.ts): do mês corrente em diante.
 * Renda e aporte (monthly-plan.repo) seguem a mesma regra, pra os dois lados do plano não
 * divergirem.
 */
function monthsToApply(year: number): number[] {
  return mesesQueOSalvarGrava(year, nowInBrazil());
}

/** Mesma coisa que applyBudgetToWholeYear, só que pra uma categoria personalizada (por id). */
export async function applyBudgetToWholeYearForCustomCategory(
  ctx: AuthContext,
  input: { year: number; customCategoryId: string; plannedAmount: number },
): Promise<void> {
  const months = monthsToApply(input.year);
  const existing = await prisma.budget.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year: input.year, customCategoryId: input.customCategoryId },
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
              userId: ctx.userId, profileId: ctx.profileId,
            },
          });
    }),
  );
}

/**
 * Valor "atual" de planejamento por categoria para a tela /orcamento, usa o mês corrente
 * (ou janeiro, se `year` for um ano diferente do atual) como referência, já que os 12 meses
 * podem ter divergido entre si se o usuário editou um mês específico depois de aplicar o
 * plano anual.
 */
export async function getAnnualBudgetPlan(ctx: AuthContext, year: number): Promise<Record<ParentCategory, number>> {
  const now = nowInBrazil();
  const referenceMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const budgets = await prisma.budget.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month: referenceMonth, parentCategory: { not: null } },
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
  const now = nowInBrazil();
  const referenceMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const budgets = await prisma.budget.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month: referenceMonth, customCategoryId: { in: customCategoryIds } },
  });
  const byCategory = new Map(budgets.map((b) => [b.customCategoryId, Number(b.plannedAmount)]));
  return Object.fromEntries(customCategoryIds.map((id) => [id, byCategory.get(id) ?? 0]));
}

/** Todos os orçamentos do ano (sem filtro de mês), alimenta o comparativo planejado x realizado. */
export async function listBudgetsForYear(ctx: AuthContext, year: number) {
  return prisma.budget.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, year } });
}

/** Soma de gastos (EXPENSE) do ano inteiro, agrupada por mês + categoria-mãe. */
export async function sumExpensesByParentCategoryForYear(ctx: AuthContext, year: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["month", "parentCategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, year, category: "EXPENSE", parentCategory: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    month: g.month,
    parentCategory: g.parentCategory as ParentCategory,
    spent: Number(g._sum.amount ?? 0),
  }));
}

/**
 * Quais gastos são "da semana" (aba Semana da tela Só gastos).
 *
 * Antes era só `createdAt` nos últimos 7 dias: o aluguel com "Repetir até dezembro" entrava 4
 * vezes (as cópias de outubro a dezembro nascem no mesmo instante) e cada parcela futura que a
 * importação da fatura cria entrava inteira — "Moradia R$ 8.000" numa semana de aluguel de
 * R$ 2.000. Agora:
 * - com dia (`entryDate`, coluna só de data): o dia está entre hoje−6 e hoje;
 * - sem dia (compra de fatura): lançado nos últimos 7 dias, e só se o mês dele já chegou —
 *   parcela de novembro não é gasto desta semana.
 * `since` e `hoje` vêm com os componentes do calendário do Brasil (nowInBrazil).
 */
export function filtroDaSemana(since: Date, hoje: Date) {
  const diaDe = (d: Date, delta = 0) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + delta));
  return {
    OR: [
      { entryDate: { gte: diaDe(hoje, -6), lte: diaDe(hoje) } },
      {
        entryDate: null,
        createdAt: { gte: since },
        OR: [{ year: { lt: hoje.getFullYear() } }, { year: hoje.getFullYear(), month: { lte: hoje.getMonth() + 1 } }],
      },
    ],
  };
}

/** Soma de gastos por categoria-mãe da última semana (ver filtroDaSemana), usado na visão
 * "semana" da tela Só gastos. */
export async function sumExpensesByParentCategorySince(ctx: AuthContext, since: Date) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", parentCategory: { not: null }, ...filtroDaSemana(since, nowInBrazil()) },
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
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", customCategoryId: { not: null }, ...filtroDaSemana(since, nowInBrazil()) },
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
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "EXPENSE", customCategoryId: { not: null } },
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
    where: { userId: ctx.userId, profileId: ctx.profileId, year, category: "EXPENSE", customCategoryId: { not: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    month: g.month,
    customCategoryId: g.customCategoryId as string,
    spent: Number(g._sum.amount ?? 0),
  }));
}

/**
 * Mês em que a vida financeira da pessoa começa dentro de `year`: o do primeiro lançamento.
 * Quem entrou em setembro não deve ver "R$ 0 de R$ 13.500 planejados" em Moradia, com
 * janeiro a agosto contados como meses de plano não cumprido. Sem lançamento nenhum, é o mês
 * atual (nada ficou pra trás). Quem já lançava no ano anterior começa em janeiro. O "hoje"
 * padrão é o de Brasília, o mesmo relógio do resto da tela.
 */
export async function getFirstEntryMonth(ctx: AuthContext, year: number, today: Date = nowInBrazil()): Promise<number> {
  const first = await prisma.monthlyEntry.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    select: { year: true, month: true },
  });
  if (!first) return year === today.getFullYear() ? today.getMonth() + 1 : 1;
  if (first.year < year) return 1;
  if (first.year > year) return 12;
  return first.month;
}
