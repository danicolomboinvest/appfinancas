import type { GoalIcon } from "@prisma/client";
import { goalProgress } from "@/lib/planning/goal-progress";
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
  return prisma.goal.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { targetDate: "asc" } });
}

export async function getOwnGoal(ctx: AuthContext, id: string) {
  return prisma.goal.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
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
  const goal = await prisma.goal.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  if (!goal) return null;
  const [a, e] = await Promise.all([
    prisma.asset.aggregate({ where: { userId: ctx.userId, profileId: ctx.profileId, goalId: id }, _sum: { currentValue: true } }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: id, category: "INVESTMENT_CONTRIBUTION" },
      select: { amount: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);
  const computed = goalProgress(
    id,
    Number(a._sum.currentValue ?? 0),
    e.map((entry) => ({
      amount: Number(entry.amount),
      allocations: entry.allocations.map((x) => ({ amount: Number(x.amount), assetGoalId: x.asset.goalId })),
    })),
  );
  return { ...goal, computedCurrentAmount: computed > 0 ? computed : Number(goal.currentAmount) };
}

function computedFields(input: GoalInput) {
  const plan = computeGoalPlan(input);
  return { monthlyContribution: plan.requiredMonthlyContribution, status: plan.status };
}

export async function createGoal(ctx: AuthContext, input: GoalInput) {
  return prisma.goal.create({
    data: { ...input, ...computedFields(input), userId: ctx.userId, profileId: ctx.profileId },
  });
}

export async function updateOwnGoal(ctx: AuthContext, id: string, input: GoalInput) {
  return prisma.goal.updateMany({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    data: { ...input, ...computedFields(input) },
  });
}

export async function deleteOwnGoal(ctx: AuthContext, id: string) {
  return prisma.goal.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * Progresso REAL de cada meta, calculado (integração, item 6): soma o valor atual dos ativos
 * vinculados à meta + os aportes registrados para ela (lançamentos INVESTMENT_CONTRIBUTION com
 * goalId). Assim, vincular um ativo ou registrar um aporte atualiza a meta sozinho. Se não há
 * nada vinculado, cai no valor manual antigo (`currentAmount`) pra não zerar metas legadas.
 */
export async function listGoalsWithProgress(ctx: AuthContext) {
  const [goals, assetSums, aportes] = await Promise.all([
    prisma.goal.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { targetDate: "asc" } }),
    prisma.asset.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: { not: null } },
      _sum: { currentValue: true },
    }),
    // Aporte que entrou num ativo DA MESMA META já está contado pelo valor daquele ativo;
    // contar os dois fazia a meta andar o dobro. O que foi pra outro ativo continua contando:
    // é dinheiro guardado pra meta, só que num lugar que a meta não enxerga sozinha.
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: { not: null }, category: "INVESTMENT_CONTRIBUTION" },
      select: { goalId: true, amount: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);

  // Mesma regra do getGoalWithProgress, na mesma função pura: duas contas parecidas em lugares
  // diferentes é como a meta passou a divergir entre a tela de Metas e o Dashboard.
  const ativosPorMeta = new Map<string, number>();
  for (const a of assetSums) if (a.goalId) ativosPorMeta.set(a.goalId, Number(a._sum.currentValue ?? 0));
  const aportesPorMeta = new Map<string, { amount: number; allocations: { amount: number; assetGoalId: string | null }[] }[]>();
  for (const e of aportes) {
    if (!e.goalId) continue;
    const lista = aportesPorMeta.get(e.goalId) ?? [];
    lista.push({
      amount: Number(e.amount),
      allocations: e.allocations.map((x) => ({ amount: Number(x.amount), assetGoalId: x.asset.goalId })),
    });
    aportesPorMeta.set(e.goalId, lista);
  }
  const byGoal = new Map<string, number>();
  for (const g of goals) {
    byGoal.set(g.id, goalProgress(g.id, ativosPorMeta.get(g.id) ?? 0, aportesPorMeta.get(g.id) ?? []));
  }

  return goals.map((g) => {
    const computed = byGoal.get(g.id) ?? 0;
    return { ...g, computedCurrentAmount: computed > 0 ? computed : Number(g.currentAmount) };
  });
}
