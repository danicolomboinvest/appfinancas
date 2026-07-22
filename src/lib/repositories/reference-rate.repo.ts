import type { RateBasis } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/** Taxas visíveis ao usuário: as suas próprias + as padrão globais (userId nulo). */
export async function listReferenceRates(ctx: AuthContext) {
  return prisma.referenceRate.findMany({
    where: { OR: [{ userId: ctx.userId }, { userId: null }] },
    orderBy: [{ name: "asc" }, { effectiveDate: "desc" }],
  });
}

export async function createReferenceRate(
  ctx: AuthContext,
  input: { name: string; rateValue: number; basis: RateBasis; effectiveDate: Date },
) {
  return prisma.referenceRate.create({
    data: { ...input, userId: ctx.userId },
  });
}

/** Só remove taxas do próprio usuário, nunca as globais nem as de outros usuários. */
export async function deleteOwnReferenceRate(ctx: AuthContext, id: string) {
  return prisma.referenceRate.deleteMany({ where: { id, userId: ctx.userId } });
}
