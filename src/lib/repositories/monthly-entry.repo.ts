import type { EntryCategory, ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export async function listMonthlyEntries(ctx: AuthContext, year: number, month: number) {
  return prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, year, month },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMonthlyEntry(
  ctx: AuthContext,
  input: {
    year: number;
    month: number;
    category: EntryCategory;
    parentCategory?: ParentCategory;
    subcategory?: string;
    description?: string;
    amount: number;
  },
) {
  return prisma.monthlyEntry.create({
    data: { ...input, userId: ctx.userId },
  });
}

/** Cria o mesmo lançamento em todos os meses restantes do ano corrente (despesa fixa recorrente). */
export async function createRecurringMonthlyEntries(
  ctx: AuthContext,
  input: {
    year: number;
    month: number;
    category: EntryCategory;
    parentCategory?: ParentCategory;
    subcategory?: string;
    description?: string;
    amount: number;
  },
) {
  const months = [];
  for (let m = input.month; m <= 12; m++) {
    months.push(m);
  }
  return prisma.monthlyEntry.createMany({
    data: months.map((month) => ({ ...input, month, userId: ctx.userId })),
  });
}

/** Subcategorias mais usadas recentemente pelo usuário (para sugestão no lançamento rápido). */
export async function listRecentSubcategories(ctx: AuthContext, limit = 6) {
  const recent = await prisma.monthlyEntry.groupBy({
    by: ["subcategory"],
    where: { userId: ctx.userId, category: "EXPENSE", subcategory: { not: null } },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: "desc" } },
    take: limit,
  });
  return recent.map((r) => r.subcategory).filter((s): s is string => s !== null);
}

/** Só remove lançamentos do próprio usuário. */
export async function deleteOwnMonthlyEntry(ctx: AuthContext, id: string) {
  return prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId } });
}
