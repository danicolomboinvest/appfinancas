import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/** Categorias personalizadas do usuário, mais recente primeiro. */
export async function listCustomCategories(ctx: AuthContext) {
  return prisma.customCategory.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });
}

export async function createCustomCategory(ctx: AuthContext, input: { name: string; icon: string }) {
  return prisma.customCategory.create({ data: { ...input, userId: ctx.userId } });
}

/**
 * Apaga uma categoria personalizada do próprio usuário. Os `Budget` planejados nela são
 * apagados junto (não faz sentido manter orçamento pra uma categoria que não existe mais);
 * os `MonthlyEntry` já lançados nela ficam, só perdem a categoria (`customCategoryId` vira
 * null via `ON DELETE SET NULL` no banco), preservando o histórico de gastos do usuário.
 */
export async function deleteOwnCustomCategory(ctx: AuthContext, id: string) {
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { userId: ctx.userId, customCategoryId: id } }),
    prisma.customCategory.deleteMany({ where: { id, userId: ctx.userId } }),
  ]);
}
