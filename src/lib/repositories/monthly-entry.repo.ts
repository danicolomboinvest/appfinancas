import type { EntryCategory } from "@prisma/client";
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
    subcategory?: string;
    description?: string;
    amount: number;
  },
) {
  return prisma.monthlyEntry.create({
    data: { ...input, userId: ctx.userId },
  });
}

/** Só remove lançamentos do próprio usuário. */
export async function deleteOwnMonthlyEntry(ctx: AuthContext, id: string) {
  return prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId } });
}
