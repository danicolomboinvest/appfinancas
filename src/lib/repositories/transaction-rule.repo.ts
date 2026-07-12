import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export async function listTransactionRules(ctx: AuthContext) {
  return prisma.transactionCategoryRule.findMany({ where: { userId: ctx.userId } });
}

/** Grava (ou atualiza) uma regra aprendida merchant → categoria para o usuário. */
export async function upsertTransactionRule(
  ctx: AuthContext,
  input: { pattern: string; parentCategory: ParentCategory; subcategory?: string },
) {
  if (!input.pattern.trim()) return null;
  const existing = await prisma.transactionCategoryRule.findFirst({
    where: { userId: ctx.userId, pattern: input.pattern },
  });
  if (existing) {
    return prisma.transactionCategoryRule.update({
      where: { id: existing.id },
      data: { parentCategory: input.parentCategory, subcategory: input.subcategory ?? null },
    });
  }
  return prisma.transactionCategoryRule.create({
    data: {
      userId: ctx.userId,
      pattern: input.pattern,
      parentCategory: input.parentCategory,
      subcategory: input.subcategory ?? null,
    },
  });
}
