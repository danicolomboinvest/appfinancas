import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { categoryLabel } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getRendaTipica, getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { computeGoalPlan } from "@/lib/planning/goal";
import { mesesAteMeta } from "@/lib/decisoes/posso-comprar";
import type { MetaResposta, ResumoMes } from "@/lib/decisoes/respostas";
import { carregarFoco, MESES } from "@/app/(app)/mensal/foco/dados";

/** As perguntas do dia a dia da Central, pelo endereço. A regra de cada uma está em lib/decisoes/respostas. */
export const PERGUNTAS: Record<string, string> = {
  semana: "Quanto posso gastar essa semana?",
  gastando: "Estou gastando demais?",
  exagerando: "Onde estou exagerando?",
  guardar: "Quanto preciso guardar?",
  meta: "Quando atinjo minha meta?",
  reserva: "Minha reserva está suficiente?",
  acabou: "Por que meu dinheiro acabou mais rápido?",
  melhorei: "Melhorei em relação ao mês passado?",
};

const mensal = (anual: number) => (anual > 0 ? Math.pow(1 + anual, 1 / 12) - 1 : 0);

async function resumoDoMes(ctx: AuthContext, ano: number, mes: number): Promise<ResumoMes> {
  const [s, porMae] = await Promise.all([getMonthlySummary(ctx, ano, mes), sumExpensesByParentCategory(ctx, ano, mes)]);
  return {
    label: MESES[mes - 1],
    renda: s.totalIncome,
    gastos: s.totalExpense,
    guardado: s.totalInvestment,
    porCategoria: Object.fromEntries(porMae.filter((p) => p.parentCategory).map((p) => [p.parentCategory as string, { label: categoryLabel(ctx.profileKind, p.parentCategory as ParentCategory), valor: p.spent }])),
  };
}

/** Tudo que as respostas da Central precisam, numa carga só (a mesma base do Foco). */
export async function carregarRespostas(ctx: AuthContext) {
  const d = await carregarFoco(ctx);
  const { year, month } = d;
  const passado = new Date(year, month - 2, 1);
  const retrasado = new Date(year, month - 3, 1);
  const tresMesesAtras = new Date(Date.UTC(year, month - 4, 1));
  const [plano, rendaTipica, gastoTipico, metas, aportesPorMeta, mesPassado, mesRetrasado, maioresPassado] = await Promise.all([
    getMonthlyPlan(ctx, year, month),
    getRendaTipica(ctx),
    getTypicalMonthlyExpense(ctx),
    listGoalsWithProgress(ctx),
    // O ritmo de verdade de cada meta: o que foi guardado pra ela nos últimos 3 meses fechados.
    prisma.monthlyEntry.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null }, entryDate: { gte: tresMesesAtras, lt: new Date(Date.UTC(year, month - 1, 1)) } },
      _sum: { amount: true },
    }),
    resumoDoMes(ctx, passado.getFullYear(), passado.getMonth() + 1),
    resumoDoMes(ctx, retrasado.getFullYear(), retrasado.getMonth() + 1),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: passado.getFullYear(), month: passado.getMonth() + 1, category: "EXPENSE" },
      select: { description: true, subcategory: true, amount: true, parentCategory: true },
      orderBy: { amount: "desc" },
      take: 3,
    }),
  ]);
  const ritmoMeta = new Map(aportesPorMeta.map((a) => [a.goalId as string, Number(a._sum.amount ?? 0) / 3]));
  const mesLabel = (k: number | null) => {
    if (k === null) return null;
    const dt = new Date(year, month - 1 + k, 1);
    return `${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
  };

  const metasResposta: MetaResposta[] = metas.map((g) => {
    const alvo = Number(g.targetAmount);
    const atual = g.computedCurrentAmount;
    const plan = g.targetDate ? computeGoalPlan({ targetAmount: alvo, currentAmount: atual, targetDate: g.targetDate, annualRate: Number(g.annualRate ?? 0), startedAt: g.createdAt }) : null;
    const ritmo = ritmoMeta.get(g.id) ?? Number(g.monthlyContribution ?? 0);
    const k = atual >= alvo ? 0 : ritmo > 0 ? mesesAteMeta({ atual, alvo, taxa: mensal(Number(g.annualRate ?? 0)) }, () => ritmo) : null;
    const mesesAtePrazo = g.targetDate ? (g.targetDate.getUTCFullYear() - year) * 12 + (g.targetDate.getUTCMonth() + 1 - month) : null;
    return {
      nome: g.name,
      alvo,
      atual,
      prazo: g.targetDate ? `${MESES[g.targetDate.getUTCMonth()]} de ${g.targetDate.getUTCFullYear()}` : null,
      necessarioPorMes: plan ? plan.requiredMonthlyContribution : Number(g.monthlyContribution ?? 0),
      ritmoPorMes: ritmo,
      chegaEm: mesLabel(k),
      noPrazo: mesesAtePrazo === null ? k !== null : k !== null && k <= mesesAtePrazo,
    };
  });

  const renda = plano && plano.plannedIncome > 0 ? plano.plannedIncome : (rendaTipica?.valor ?? null);
  const fund = d.fund;
  const livre = d.foco.livre;

  return {
    d,
    renda,
    gastoReal: gastoTipico?.monthlyAverage ?? null,
    metas: metasResposta,
    reserva: fund
      ? { atual: Number(fund.currentAmount), custoMensal: Number(fund.monthlyExpenseBase), mesesMeta: fund.targetMonths, porMes: Number(fund.monthlyContribution), alvo: Number(fund.targetAmount) }
      : null,
    livre,
    mesPassado,
    mesRetrasado,
    maioresPassado: maioresPassado.map((g) => ({ descricao: g.description ?? g.subcategory ?? "Sem descrição", valor: Number(g.amount), categoria: g.parentCategory ? categoryLabel(ctx.profileKind, g.parentCategory) : null })),
  };
}
