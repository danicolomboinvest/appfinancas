import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Planejamento de RENDA e APORTE por mês — o outro lado do orçamento.
 *
 * O Budget cobre só o que sai. Faltava dizer quanto a pessoa espera ganhar e quanto pretende
 * guardar: sem isso o app comparava gasto com planejado, mas não tinha como dizer "você ganhou
 * menos do que esperava" nem "aportou metade do que planejou".
 */

export type MonthPlanValues = { plannedIncome: number; plannedInvestment: number };

export async function getAnnualMonthlyPlan(ctx: AuthContext, year: number): Promise<Map<number, MonthPlanValues>> {
  const linhas = await prisma.monthlyPlan.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, year } });
  return new Map(
    linhas.map((l) => [
      l.month,
      { plannedIncome: Number(l.plannedIncome), plannedInvestment: Number(l.plannedInvestment) },
    ]),
  );
}

export async function getMonthlyPlan(ctx: AuthContext, year: number, month: number): Promise<MonthPlanValues | null> {
  const l = await prisma.monthlyPlan.findUnique({
    where: { userId_profileId_year_month: { userId: ctx.userId, profileId: ctx.profileId, year, month } },
  });
  return l ? { plannedIncome: Number(l.plannedIncome), plannedInvestment: Number(l.plannedInvestment) } : null;
}

/**
 * Grava o mesmo valor nos 12 meses do ano — mesma lógica do orçamento por categoria.
 *
 * Uma linha por mês, mesmo com valor repetido, porque um dia ela vai querer ajustar dezembro
 * (décimo terceiro) sem mexer no resto do ano, e o formato já comporta isso.
 */
export async function applyMonthlyPlanToWholeYear(ctx: AuthContext, year: number, values: MonthPlanValues) {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  await prisma.$transaction(
    meses.map((month) =>
      prisma.monthlyPlan.upsert({
        where: { userId_profileId_year_month: { userId: ctx.userId, profileId: ctx.profileId, year, month } },
        create: { userId: ctx.userId, profileId: ctx.profileId, year, month, ...values },
        update: values,
      }),
    ),
  );
}
