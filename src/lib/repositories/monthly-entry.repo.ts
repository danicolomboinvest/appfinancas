import type { EntryCategory, ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";

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
    customCategoryId?: string;
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
    customCategoryId?: string;
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

/**
 * Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe (para sugestão no
 * lançamento rápido) — agrupado por parentCategory pra não sugerir, por exemplo, "Aluguel"
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
