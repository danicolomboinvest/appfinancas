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

/**
 * Uma meta com o progresso REAL: os ativos ligados a ela MAIS os aportes feitos pra ela que não
 * estão contados nesses ativos.
 *
 * A conta tem que evitar dois erros opostos. Contar o aporte E o ativo em que ele entrou dobra
 * o mesmo dinheiro (aportei R$ 1.000 pra viagem, disse que foi pro CDB da viagem, a meta pulava
 * R$ 2.000). Mas descontar o aporte que foi pra um ativo que NÃO é da meta some com dinheiro que
 * a pessoa guardou de verdade. Então só é descontado o pedaço que entrou num ativo ligado à
 * MESMA meta — esse já está sendo contado pelo valor do ativo.
 */
export async function getGoalWithProgress(ctx: AuthContext, id: string) {
  const goal = await prisma.goal.findFirst({ where: { id, userId: ctx.userId } });
  if (!goal) return null;
  const [a, e] = await Promise.all([
    prisma.asset.aggregate({ where: { userId: ctx.userId, goalId: id }, _sum: { currentValue: true } }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, goalId: id, category: "INVESTMENT_CONTRIBUTION" },
      select: { amount: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);
  const aportesNaoContados = e.reduce((sum, entry) => {
    const jaNoAtivoDaMeta = entry.allocations
      .filter((x) => x.asset.goalId === id)
      .reduce((s, x) => s + Number(x.amount), 0);
    return sum + Math.max(0, Number(entry.amount) - jaNoAtivoDaMeta);
  }, 0);
  const computed = Number(a._sum.currentValue ?? 0) + aportesNaoContados;
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
 * Progresso REAL de cada meta, calculado (integração, item 6): soma o valor atual dos ativos
 * vinculados à meta + os aportes registrados para ela (lançamentos INVESTMENT_CONTRIBUTION com
 * goalId). Assim, vincular um ativo ou registrar um aporte atualiza a meta sozinho. Se não há
 * nada vinculado, cai no valor manual antigo (`currentAmount`) pra não zerar metas legadas.
 */
export async function listGoalsWithProgress(ctx: AuthContext) {
  const [goals, assetSums, aportes] = await Promise.all([
    prisma.goal.findMany({ where: { userId: ctx.userId }, orderBy: { targetDate: "asc" } }),
    prisma.asset.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, goalId: { not: null } },
      _sum: { currentValue: true },
    }),
    // Aporte que entrou num ativo DA MESMA META já está contado pelo valor daquele ativo;
    // contar os dois fazia a meta andar o dobro. O que foi pra outro ativo continua contando:
    // é dinheiro guardado pra meta, só que num lugar que a meta não enxerga sozinha.
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, goalId: { not: null }, category: "INVESTMENT_CONTRIBUTION" },
      select: { goalId: true, amount: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);

  const byGoal = new Map<string, number>();
  for (const a of assetSums) if (a.goalId) byGoal.set(a.goalId, (byGoal.get(a.goalId) ?? 0) + Number(a._sum.currentValue ?? 0));
  for (const e of aportes) {
    if (!e.goalId) continue;
    const jaNoAtivoDaMeta = e.allocations
      .filter((x) => x.asset.goalId === e.goalId)
      .reduce((s, x) => s + Number(x.amount), 0);
    const naoContado = Math.max(0, Number(e.amount) - jaNoAtivoDaMeta);
    if (naoContado > 0) byGoal.set(e.goalId, (byGoal.get(e.goalId) ?? 0) + naoContado);
  }

  return goals.map((g) => {
    const computed = byGoal.get(g.id) ?? 0;
    return { ...g, computedCurrentAmount: computed > 0 ? computed : Number(g.currentAmount) };
  });
}
