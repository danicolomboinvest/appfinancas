import type { EntryCategory, ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { sameDayInMonth } from "@/lib/date/recurrence";

export async function listMonthlyEntries(ctx: AuthContext, year: number, month: number) {
  return prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, year, month },
    orderBy: { createdAt: "desc" },
  });
}

export type MonthlyEntryInput = {
  year: number;
  month: number;
  category: EntryCategory;
  parentCategory?: ParentCategory;
  customCategoryId?: string;
  subcategory?: string;
  description?: string;
  amount: number;
  /** Data em que a despesa/renda aconteceu (o dia). year/month seguem mandando na consolidação. */
  entryDate?: Date;
  /** Meta vinculada (faz sentido principalmente em aportes). */
  goalId?: string;
  /** Lote de importação que criou este lançamento (só em imports de extrato/fatura). */
  importBatchId?: string;
};

/**
 * goalId/customCategoryId chegam do cliente: só valem se pertencerem MESMO ao usuário, senão
 * um id adivinhado/vazado linkaria lançamento à meta ou categoria de outra conta. Id que não
 * é do usuário é simplesmente descartado (vira sem vínculo), sem quebrar o lançamento.
 */
async function resolveOwnRefs(
  ctx: AuthContext,
  input: Pick<MonthlyEntryInput, "goalId" | "customCategoryId">,
): Promise<{ goalId?: string; customCategoryId?: string }> {
  const [goal, category] = await Promise.all([
    input.goalId
      ? prisma.goal.findFirst({ where: { id: input.goalId, userId: ctx.userId }, select: { id: true } })
      : null,
    input.customCategoryId
      ? prisma.customCategory.findFirst({ where: { id: input.customCategoryId, userId: ctx.userId }, select: { id: true } })
      : null,
  ]);
  return { goalId: goal?.id, customCategoryId: category?.id };
}

export async function createMonthlyEntry(ctx: AuthContext, input: MonthlyEntryInput) {
  const refs = await resolveOwnRefs(ctx, input);
  return prisma.monthlyEntry.create({
    data: { ...input, ...refs, userId: ctx.userId },
  });
}

/** Atualiza um lançamento do próprio usuário (updateMany garante o filtro por userId). */
export async function updateOwnMonthlyEntry(ctx: AuthContext, id: string, input: MonthlyEntryInput) {
  const refs = await resolveOwnRefs(ctx, input);
  return prisma.monthlyEntry.updateMany({
    where: { id, userId: ctx.userId },
    data: {
      ...input,
      // Campos opcionais ausentes devem LIMPAR o valor antigo (ex.: trocar de categoria-mãe
      // para personalizada), não manter, por isso null explícito em vez de undefined.
      parentCategory: input.parentCategory ?? null,
      customCategoryId: refs.customCategoryId ?? null,
      subcategory: input.subcategory ?? null,
      description: input.description ?? null,
      entryDate: input.entryDate ?? null,
      goalId: refs.goalId ?? null,
    },
  });
}

/**
 * Cria o mesmo lançamento em todos os meses restantes do ano corrente (despesa fixa recorrente).
 *
 * A data acompanha: antes, as cópias dos meses seguintes nasciam SEM data nenhuma — o que
 * deixava quem usa recorrência fora do gráfico diário e do "gastos da semana registrados",
 * justamente quem lança de forma mais organizada. Sem data no lançamento original (ninguém é
 * obrigado a preencher), as cópias seguem sem data também: não dá pra inventar um dia.
 */
export async function createRecurringMonthlyEntries(
  ctx: AuthContext,
  input: {
    year: number;
    month: number;
    category: EntryCategory;
    parentCategory?: ParentCategory;
    customCategoryId?: string;
    subcategory?: string;
    description?: string;
    amount: number;
    entryDate?: Date;
  },
) {
  const refs = await resolveOwnRefs(ctx, input);
  const months = [];
  for (let m = input.month; m <= 12; m++) {
    months.push(m);
  }
  return prisma.monthlyEntry.createMany({
    data: months.map((month) => ({
      ...input,
      customCategoryId: refs.customCategoryId,
      month,
      entryDate: input.entryDate ? sameDayInMonth(input.entryDate, input.year, month) : null,
      userId: ctx.userId,
    })),
  });
}

/**
 * Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe (para sugestão no
 * lançamento rápido), agrupado por parentCategory pra não sugerir, por exemplo, "Aluguel"
 * (Moradia) quando o usuário está lançando uma despesa em Alimentação.
 */
export async function listRecentSubcategories(
  ctx: AuthContext,
  limit = 6,
): Promise<Record<ParentCategory, string[]>> {
  const recent = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory", "subcategory"],
    where: { userId: ctx.userId, category: "EXPENSE", parentCategory: { not: null }, subcategory: { not: null } },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: "desc" } },
  });

  const result = Object.fromEntries(PARENT_CATEGORIES.map((pc) => [pc, [] as string[]])) as Record<
    ParentCategory,
    string[]
  >;
  for (const row of recent) {
    if (!row.parentCategory || !row.subcategory) continue;
    const bucket = result[row.parentCategory];
    if (bucket.length < limit) bucket.push(row.subcategory);
  }
  return result;
}

/** Só remove lançamentos do próprio usuário. */
export async function deleteOwnMonthlyEntry(ctx: AuthContext, id: string) {
  return prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId } });
}

/**
 * Quantos lançamentos COM DATA caíram nos últimos `days` dias — alimenta o "já registrei os
 * gastos da semana?" do checklist. Conta só quem tem entryDate: sem data não dá pra afirmar
 * que aconteceu nesta semana (o mês/ano do lançamento não diz o dia).
 */
export async function countRecentDatedEntries(ctx: AuthContext, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.monthlyEntry.count({
    where: { userId: ctx.userId, entryDate: { gte: since } },
  });
}
