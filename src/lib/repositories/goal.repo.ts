import type { GoalIcon } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { computeGoalPlan } from "@/lib/planning/goal";

export type GoalInput = {
  name: string;
  targetAmount: number;
  targetDate: Date;
  currentAmount: number;
  annualRate: number;
  icon: GoalIcon;
};

export async function listGoals(ctx: AuthContext) {
  return prisma.goal.findMany({ where: { userId: ctx.userId }, orderBy: { targetDate: "asc" } });
}

export async function getOwnGoal(ctx: AuthContext, id: string) {
  return prisma.goal.findFirst({ where: { id, userId: ctx.userId } });
}

function computedFields(input: GoalInput) {
  const plan = computeGoalPlan(input);
  return { monthlyContribution: plan.requiredMonthlyContribution, status: plan.status };
}

export async function createGoal(ctx: AuthContext, input: GoalInput) {
  return prisma.goal.create({
    data: { ...input, ...computedFields(input), userId: ctx.userId },
  });
}

export async function updateOwnGoal(ctx: AuthContext, id: string, input: GoalInput) {
  return prisma.goal.updateMany({
    where: { id, userId: ctx.userId },
    data: { ...input, ...computedFields(input) },
  });
}

export async function deleteOwnGoal(ctx: AuthContext, id: string) {
  return prisma.goal.deleteMany({ where: { id, userId: ctx.userId } });
}
