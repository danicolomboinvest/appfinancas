import type { GoalIcon } from "@prisma/client";
import { aportesJaOcorridosWhere, goalCurrentAmount, type GoalContribution } from "@/lib/planning/goal-progress";
import { nowInBrazil } from "@/lib/date/brazil-now";
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
 *
 * Junto disso vale o "Já guardado" digitado (`currentAmount`): ele mais os aportes marcados depois
 * dele são o piso, pra o digitado nunca sumir, cada aporte novo mover a meta e o mesmo dinheiro
 * nunca contar duas vezes (ver `goalCurrentAmount`).
 */
export async function getGoalWithProgress(ctx: AuthContext, id: string) {
  const goal = await prisma.goal.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  if (!goal) return null;
  const [a, e] = await Promise.all([
    prisma.asset.aggregate({ where: { userId: ctx.userId, profileId: ctx.profileId, goalId: id }, _sum: { currentValue: true } }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: id, category: "INVESTMENT_CONTRIBUTION", ...aportesJaOcorridosWhere(nowInBrazil()) },
      // createdAt: aporte marcado depois da correção do formulário soma em cima do "Já guardado".
      select: { amount: true, createdAt: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);
  const computedCurrentAmount = goalCurrentAmount(
    id,
    Number(goal.currentAmount),
    Number(a._sum.currentValue ?? 0),
    e.map((entry) => ({
      amount: Number(entry.amount),
      createdAt: entry.createdAt,
      allocations: entry.allocations.map((x) => ({ amount: Number(x.amount), assetGoalId: x.asset.goalId })),
    })),
  );
  return { ...goal, computedCurrentAmount };
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
  // Os ativos da meta viram "sem objetivo" junto. A FK só zerava o goalId e deixava o objetivo
  // "Meta": o ativo ficava fora de todos os cards do "Por objetivo" e o valor sumia da tela.
  const [, result] = await prisma.$transaction([
    prisma.asset.updateMany({
      where: { goalId: id, userId: ctx.userId, profileId: ctx.profileId },
      data: { objective: "OUTRO", goalId: null },
    }),
    prisma.goal.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } }),
  ]);
  return result;
}

/**
 * Progresso REAL de cada meta, calculado (integração, item 6): soma o valor atual dos ativos
 * vinculados à meta + os aportes registrados para ela (lançamentos INVESTMENT_CONTRIBUTION com
 * goalId). Assim, vincular um ativo ou registrar um aporte atualiza a meta sozinho. O valor
 * manual (`currentAmount`) é o saldo de partida e entra pela regra de `goalCurrentAmount`.
 */
export async function listGoalsWithProgress(ctx: AuthContext) {
  const hoje = nowInBrazil();
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
      // Aporte de mês que ainda não chegou (cópia do "Repetir todo mês") não é dinheiro guardado.
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: { not: null }, category: "INVESTMENT_CONTRIBUTION", ...aportesJaOcorridosWhere(hoje) },
      select: { goalId: true, year: true, month: true, amount: true, createdAt: true, allocations: { select: { amount: true, asset: { select: { goalId: true } } } } },
    }),
  ]);

  // Mesma regra do getGoalWithProgress, na mesma função pura: duas contas parecidas em lugares
  // diferentes é como a meta passou a divergir entre a tela de Metas e o Dashboard.
  const ativosPorMeta = new Map<string, number>();
  for (const a of assetSums) if (a.goalId) ativosPorMeta.set(a.goalId, Number(a._sum.currentValue ?? 0));
  const aportesPorMeta = new Map<string, (GoalContribution & { createdAt: Date })[]>();
  // Metas que já têm aporte NESTE mês (Fluxo, extrato, "Marcar aporte"): o card não pode
  // oferecer "Marcar aporte" de novo e duplicar o dinheiro.
  const comAporteNoMes = new Set<string>();
  for (const e of aportes) {
    if (!e.goalId) continue;
    if (e.year === hoje.getFullYear() && e.month === hoje.getMonth() + 1) comAporteNoMes.add(e.goalId);
    const lista = aportesPorMeta.get(e.goalId) ?? [];
    lista.push({
      amount: Number(e.amount),
      createdAt: e.createdAt,
      allocations: e.allocations.map((x) => ({ amount: Number(x.amount), assetGoalId: x.asset.goalId })),
    });
    aportesPorMeta.set(e.goalId, lista);
  }
  return goals.map((g) => ({
    ...g,
    computedCurrentAmount: goalCurrentAmount(g.id, Number(g.currentAmount), ativosPorMeta.get(g.id) ?? 0, aportesPorMeta.get(g.id) ?? []),
    temAporteNoMes: comAporteNoMes.has(g.id),
  }));
}
