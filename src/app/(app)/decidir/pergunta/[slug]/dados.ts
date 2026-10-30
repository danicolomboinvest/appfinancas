import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { categoryLabel } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
import { periodoDoMes } from "@/lib/mes/periodo";
import { sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { getLimiteDasMetas, getRendaMedia } from "@/lib/repositories/renda-media.repo";
import { prazoApertado } from "@/lib/metas/prazo-que-cabe";
import { parseTripPlan } from "@/lib/travel/assistente";
import { computeGoalPlan } from "@/lib/planning/goal";
import { mesesAteMeta } from "@/lib/decisoes/posso-comprar";
import { ritmoMensalDaMeta, type MetaResposta, type ResumoMes } from "@/lib/decisoes/respostas";
import { ehCasal } from "@/lib/profiles/casal";
import { lerDecisao } from "@/lib/repositories/decisao.repo";
import { carregarFoco, MESES } from "@/app/(app)/mensal/foco/dados";
import { fotoDaMeta } from "@/lib/metas/tipos";

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
    porCategoria: Object.fromEntries(porMae.filter((p) => p.parentCategory).map((p) => [p.parentCategory as string, { label: categoryLabel(ctx.categorias ?? ctx.profileKind, p.parentCategory as ParentCategory), valor: p.spent }])),
  };
}

/** Tudo que as respostas da Central precisam, numa carga só (a mesma base do Foco). */
export async function carregarRespostas(ctx: AuthContext) {
  const [d, diaInicio] = await Promise.all([carregarFoco(ctx), getDiaInicioMes(ctx)]);
  const { year, month } = d;
  const passado = new Date(year, month - 2, 1);
  const retrasado = new Date(year, month - 3, 1);
  // Os 3 meses fechados pela data: do primeiro dia do mês de 3 meses atrás até o primeiro dia do mês
  // de agora, no período da pessoa (30/10/2026); sem dia escolhido, o dia 1 do calendário.
  const primeiroDia = (m: { year: number; month: number }) => {
    const i = periodoDoMes(m.year, m.month, diaInicio).inicio;
    return new Date(Date.UTC(i.getFullYear(), i.getMonth(), i.getDate()));
  };
  const tresMesesAtras = primeiroDia({ year: new Date(year, month - 4, 1).getFullYear(), month: new Date(year, month - 4, 1).getMonth() + 1 });
  const inicioDoMesDeAgora = primeiroDia({ year, month });
  const [plano, rendaMedia, gastoTipico, metas, aportesPorMeta, mesPassado, mesRetrasado, maioresPassado, rendaDoCasal, limite] = await Promise.all([
    getMonthlyPlan(ctx, year, month),
    getRendaMedia(ctx),
    getTypicalMonthlyExpense(ctx),
    listGoalsWithProgress(ctx),
    // O ritmo de verdade de cada meta: o que foi guardado pra ela nos últimos 3 meses fechados.
    // Por mês também: dá pra saber em quantos meses entrou dinheiro pra meta.
    prisma.monthlyEntry.groupBy({
      by: ["goalId", "year", "month"],
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null }, entryDate: { gte: tresMesesAtras, lt: inicioDoMesDeAgora } },
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
    // Casal que só conta a conta conjunta: a regra dos 90% não vale (o mesmo do "Posso comprar?").
    ehCasal(ctx.profileKind) ? lerDecisao(ctx, "casal_renda", "renda") : Promise.resolve(null),
    // Quanto cabe por mês nas metas: o selo "prazo apertado" (o mesmo da lista de Metas).
    getLimiteDasMetas(ctx),
  ]);
  const somaPorMeta = new Map<string, { soma: number; meses: number }>();
  for (const a of aportesPorMeta) {
    const atual = somaPorMeta.get(a.goalId as string) ?? { soma: 0, meses: 0 };
    const valor = Number(a._sum.amount ?? 0);
    somaPorMeta.set(a.goalId as string, { soma: atual.soma + valor, meses: atual.meses + (valor > 0 ? 1 : 0) });
  }
  // A média divide pelos meses em que a meta já existia (até 3): meta de agosto não divide por 3 em outubro.
  const ritmoMeta = new Map(
    metas.flatMap((g) => {
      const s = somaPorMeta.get(g.id);
      if (!s) return [];
      const criada = new Date(g.createdAt.getTime() - 3 * 3_600_000); // horário de Brasília
      return [[g.id, ritmoMensalDaMeta({ soma: s.soma, mesesComGuardado: s.meses, criadaEm: { ano: criada.getUTCFullYear(), mes: criada.getUTCMonth() + 1 }, hoje: { ano: year, mes: month } })] as const];
    }),
  );
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
    // Vencida só depois que o MÊS do prazo acabou (a mesma regra do Foco). Aí o plano da meta
    // devolve o que falta inteiro como "por mês"; o certo é o que ela combinou guardar.
    const vencida = atual < alvo && mesesAtePrazo !== null && mesesAtePrazo < 0;
    // A da Viagem edita no assistente dela: sem o selo, como na lista de Metas.
    const apertado = Boolean(plan) && !vencida && atual < alvo && parseTripPlan((g as { viagem?: unknown }).viagem) === null && prazoApertado(plan!.requiredMonthlyContribution, limite);
    return {
      id: g.id,
      nome: g.name,
      alvo,
      atual,
      prazo: g.targetDate ? `${MESES[g.targetDate.getUTCMonth()]} de ${g.targetDate.getUTCFullYear()}` : null,
      necessarioPorMes: plan && !vencida ? plan.requiredMonthlyContribution : Number(g.monthlyContribution ?? 0),
      ritmoPorMes: ritmo,
      chegaEm: mesLabel(k),
      chegaEmMeses: k,
      noPrazo: vencida ? false : mesesAtePrazo === null ? k !== null : k !== null && k <= mesesAtePrazo,
      vencida,
      apertado,
    };
  });

  // Para os caminhos guiados (Guardar mais e Minha meta): a foto, a taxa ao mês, o prazo em meses
  // e quanto foi para a meta em cada um dos 3 últimos meses fechados.
  const tres = [3, 2, 1].map((k) => {
    const dt = new Date(year, month - 1 - k, 1);
    return { ano: dt.getFullYear(), mes: dt.getMonth() + 1, rotulo: MESES[dt.getMonth()].slice(0, 3) };
  });
  const metasDoFluxo = metas
    .filter((g) => g.computedCurrentAmount < Number(g.targetAmount))
    .map((g) => {
      const resp = metasResposta.find((x) => x.id === g.id)!;
      return {
        id: g.id,
        nome: g.name,
        foto: fotoDaMeta({ fotoUrl: (g as { fotoUrl?: string | null }).fotoUrl ?? null, icon: g.icon, name: g.name }),
        atual: g.computedCurrentAmount,
        alvo: Number(g.targetAmount),
        taxaMensal: mensal(Number(g.annualRate ?? 0)),
        prazoMeses: g.targetDate ? (g.targetDate.getUTCFullYear() - year) * 12 + (g.targetDate.getUTCMonth() + 1 - month) : null,
        prazoTexto: g.targetDate ? `${MESES[g.targetDate.getUTCMonth()].slice(0, 3)}/${g.targetDate.getUTCFullYear()}` : null,
        ritmo: resp.ritmoPorMes,
        necessario: resp.necessarioPorMes,
        noPrazo: resp.noPrazo,
        apertado: Boolean(resp.apertado),
        ultimos3: tres.map((t) => ({
          rotulo: t.rotulo,
          valor: aportesPorMeta.filter((a) => a.goalId === g.id && a.year === t.ano && a.month === t.mes).reduce((s2, a) => s2 + Number(a._sum.amount ?? 0), 0),
        })),
      };
    });

  // A renda digitada no plano do mês vence; sem ela, a média dos últimos 12 meses fechados.
  const renda = plano && plano.plannedIncome > 0 ? plano.plannedIncome : (rendaMedia?.valor ?? null);
  const mesesDaRenda = plano && plano.plannedIncome > 0 ? null : (rendaMedia?.meses ?? null);
  const fund = d.fund;
  const livre = d.foco.livre;

  return {
    d,
    renda,
    mesesDaRenda,
    regra90: rendaDoCasal !== "conjunta",
    gastoReal: gastoTipico?.monthlyAverage ?? null,
    metas: metasResposta,
    metasDoFluxo,
    reserva: fund
      ? { atual: Number(fund.currentAmount), custoMensal: Number(fund.monthlyExpenseBase), mesesMeta: fund.targetMonths, porMes: Number(fund.monthlyContribution), alvo: Number(fund.targetAmount) }
      : null,
    livre,
    mesPassado,
    mesRetrasado,
    maioresPassado: maioresPassado.map((g) => ({ descricao: g.description ?? g.subcategory ?? "Sem descrição", valor: Number(g.amount), categoria: g.parentCategory ? categoryLabel(ctx.categorias ?? ctx.profileKind, g.parentCategory) : null })),
  };
}
