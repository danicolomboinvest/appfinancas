import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type PlanningParamsInput = {
  currentAge: number;
  retirementAge: number;
  lifeExpectancyAge?: number;
  currentPatrimony: number;
  monthlyContributionAccumulation: number;
  accumulationAnnualRate: number;
  inflationAnnualRate: number;
  usufructAnnualRate: number;
  desiredPassiveIncome: number;
  otherPassiveIncome: number;
};

export async function getPlanningParams(ctx: AuthContext) {
  return prisma.planningParams.findUnique({ where: { profileId: ctx.profileId } });
}

export async function upsertPlanningParams(ctx: AuthContext, input: PlanningParamsInput) {
  return prisma.planningParams.upsert({
    where: { profileId: ctx.profileId },
    update: input,
    create: { ...input, userId: ctx.userId, profileId: ctx.profileId },
  });
}
