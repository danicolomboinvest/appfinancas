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

/** Uma meta com o progresso REAL calculado (ativos vinculados + aportes) — item 6. */
export async function getGoalWithProgress(ctx: AuthContext, id: string) {
  const goal = await prisma.goal.findFirst({ where: { id, userId: ctx.userId } });
  if (!goal) return null;
  const [a, e] = await Promise.all([
    prisma.asset.aggregate({ where: { userId: ctx.userId, goalId: id }, _sum: { currentValue: true } }),
    prisma.monthlyEntry.aggregate({
      where: { userId: ctx.userId, goalId: id, category: "INVESTMENT_CONTRIBUTION" },
      _sum: { amount: true },
    }),
  ]);
  const computed = Number(a._sum.currentValue ?? 0) + Number(e._sum.amount ?? 0);
  return { ...goal, computedCurrentAmount: computed > 0 ? computed : Number(goal.currentAmount) };
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

/**
 * Progresso REAL de cada meta, calculado (integração — item 6): soma o valor atual dos ativos
 * vinculados à meta + os aportes registrados para ela (lançamentos INVESTMENT_CONTRIBUTION com
 * goalId). Assim, vincular um ativo ou registrar um aporte atualiza a meta sozinho. Se não há
 * nada vinculado, cai no valor manual antigo (`currentAmount`) pra não zerar metas legadas.
 */
export async function listGoalsWithProgress(ctx: AuthContext) {
  const [goals, assetSums, aporteSums] = await Promise.all([
    prisma.goal.findMany({ where: { userId: ctx.userId }, orderBy: { targetDate: "asc" } }),
    prisma.asset.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, goalId: { not: null } },
      _sum: { currentValue: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, goalId: { not: null }, category: "INVESTMENT_CONTRIBUTION" },
      _sum: { amount: true },
    }),
  ]);

  const byGoal = new Map<string, number>();
  for (const a of assetSums) if (a.goalId) byGoal.set(a.goalId, (byGoal.get(a.goalId) ?? 0) + Number(a._sum.currentValue ?? 0));
  for (const e of aporteSums) if (e.goalId) byGoal.set(e.goalId, (byGoal.get(e.goalId) ?? 0) + Number(e._sum.amount ?? 0));

  return goals.map((g) => {
    const computed = byGoal.get(g.id) ?? 0;
    return { ...g, computedCurrentAmount: computed > 0 ? computed : Number(g.currentAmount) };
  });
}
