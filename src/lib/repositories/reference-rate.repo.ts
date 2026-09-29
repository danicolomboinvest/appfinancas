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

/** Taxa anual padrão pra uma meta nova, como FRAÇÃO (0.1065 = 10,65% — unidade de taxa do
 * sistema inteiro): o CDI das taxas de referência do app (global ou do usuário); sem CDI
 * cadastrado, 0.08 (8% a.a.) conservador. Mora aqui (e não na action da viagem) porque o
 * planejador precisa da MESMA taxa pra prometer o mesmo aporte que a meta vai pedir. */
export async function defaultGoalAnnualRate(userId: string): Promise<number> {
  const cdi = await prisma.referenceRate.findFirst({
    where: {
      OR: [{ userId }, { userId: null }],
      name: { contains: "CDI", mode: "insensitive" },
      basis: { in: ["ANNUAL_252", "ANNUAL_365"] },
    },
    // Taxa do próprio usuário ganha da global. O "nulls: last" é o que faz isso valer: no
    // Postgres, DESC põe os nulos PRIMEIRO, e sem ele o CDI global (userId nulo) sempre vencia.
    orderBy: [{ userId: { sort: "desc", nulls: "last" } }, { effectiveDate: "desc" }],
    select: { rateValue: true },
  });
  const rate = cdi ? Number(cdi.rateValue) : NaN;
  return Number.isFinite(rate) && rate > 0 && rate <= 3 ? rate : 0.08;
}
