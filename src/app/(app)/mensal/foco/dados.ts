import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { categoryLabel } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { contarGastosReaisDoMes, getUltimoGastoAte, listEntriesForMonths, somarGastosPreCriados } from "@/lib/repositories/monthly-entry.repo";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { prisma } from "@/lib/db/prisma";
import { carregarRevisaoAntigos } from "./revisar/dados";
import { existeDecisao, listarCancelamentosPraConfirmar, listarCompraAmanhaPendentes, listarDecisoesRaioX, listarTetosDoMes } from "@/lib/repositories/decisao.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { montarFoco } from "@/lib/decisoes/foco";
import { acharRecorrentes } from "@/lib/decisoes/raio-x";
import { chaveDaSemana, chaveDoMes, lerRitmo } from "./ritmo";

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIA_MS = 86_400_000;
/** Contas fixas: pagas de uma vez no começo do mês, não "correm". Só estouro vale aviso. */
const CATEGORIAS_FIXAS = new Set<string>(["MORADIA", "EDUCACAO", "IMPOSTOS"]);

/** Os últimos N meses antes do atual (pra achar o que se repete). */
function mesesAnteriores(ano: number, mes: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ano, mes - 2 - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

/**
 * Tudo que o Raio-X precisa: os gastos recorrentes e o que a pessoa já decidiu sobre cada um.
 * Só meses fechados: o mês corrente pela metade puxaria a média dos hábitos pra baixo.
 */
export async function carregarRaioX(ctx: AuthContext, ano: number, mes: number) {
  const meses = mesesAnteriores(ano, mes, 5);
  const [entradas, decididos] = await Promise.all([listEntriesForMonths(ctx, meses), listarDecisoesRaioX(ctx)]);
  const itens = acharRecorrentes(
    entradas
      .filter((e) => e.category === "EXPENSE")
      .map((e) => ({ description: e.description, amount: Number(e.amount), year: e.year, month: e.month, parentCategory: e.parentCategory, subcategory: e.subcategory })),
  );
  return { itens, decididos };
}

/**
 * Carrega o mês da pessoa uma vez e monta tudo que as telas de decisão usam: a aba Foco, o
 * ritual da semana e o fechamento do mês leem daqui, pra nunca mostrarem números diferentes.
 */
export async function carregarFoco(ctx: AuthContext) {
  const money = await serverMoney();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const t = voz.titulos;
  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dia = now.getDate();
  const diasNoMes = new Date(year, month, 0).getDate();
  const anterior = new Date(year, month - 2, 1);
  const mesAnterior = { year: anterior.getFullYear(), month: anterior.getMonth() + 1, label: MESES[anterior.getMonth()] };
  const semana = chaveDaSemana(now);

  const [user, budgets, spentByParent, spentByCustom, customCategories, summary, plan, goals, fund, lastExpense, tetos, pendentes, ritualFeito, fechamentoFeito, raiox, gastosReais, preCriados, cancelamentos, viradaFeita, lancamentosAnoPassado, paraRevisar] =
    await Promise.all([
      getOwnUser(ctx),
      listBudgets(ctx, year, month),
      sumExpensesByParentCategory(ctx, year, month),
      sumExpensesByCustomCategory(ctx, year, month),
      listCustomCategories(ctx),
      getMonthlySummary(ctx, year, month),
      getMonthlyPlan(ctx, year, month),
      listGoalsWithProgress(ctx),
      getEmergencyFund(ctx),
      getUltimoGastoAte(ctx, new Date(Date.UTC(year, month - 1, dia))),
      listarTetosDoMes(ctx, chaveDoMes(year, month)),
      listarCompraAmanhaPendentes(ctx),
      existeDecisao(ctx, "ritual", semana),
      existeDecisao(ctx, "fechamento", chaveDoMes(mesAnterior.year, mesAnterior.month)),
      // O Raio-X é da pessoa: a empresa nem busca os 5 meses de extrato.
      ehEmpresa(ctx.profileKind) ? { itens: [], decididos: new Set<string>() } : carregarRaioX(ctx, year, month),
      contarGastosReaisDoMes(ctx, year, month),
      somarGastosPreCriados(ctx, year, month),
      listarCancelamentosPraConfirmar(ctx, new Date(Date.UTC(year, month - 1, 1, 3)), `${year}-${String(month).padStart(2, "0")}`),
      // Virada do ano: só nos 3 primeiros meses, e só pra quem usou o app no ano passado.
      month <= 3 ? existeDecisao(ctx, "virada_ano", String(year)) : Promise.resolve(true),
      month <= 3 ? prisma.monthlyEntry.count({ where: { userId: ctx.userId, profileId: ctx.profileId, year: year - 1 } }) : Promise.resolve(0),
      carregarRevisaoAntigos(ctx),
    ]);
  const ritmo = lerRitmo(user.ritmoAcompanhamento);

  const nomePersonalizada = new Map(customCategories.map((c) => [c.id, c.name]));
  const gastoPorMae = new Map(spentByParent.map((s) => [s.parentCategory as string, s.spent]));
  const gastoPorPersonalizada = new Map(spentByCustom.map((s) => [s.customCategoryId, s.spent]));
  const rotulosDasMaes = new Set(budgets.filter((b) => b.parentCategory).map((b) => categoryLabel(ctx.profileKind, b.parentCategory as ParentCategory)));
  const categorias = budgets
    .filter((b) => Number(b.plannedAmount) > 0)
    .map((b) => {
      if (b.parentCategory) {
        const key = b.parentCategory as string;
        return { key, label: categoryLabel(ctx.profileKind, b.parentCategory as ParentCategory), planejado: Number(b.plannedAmount), gasto: Math.max(0, gastoPorMae.get(key) ?? 0), fixa: CATEGORIAS_FIXAS.has(key), fixoAutomatico: preCriados.porMae.get(key) ?? 0 };
      }
      const nome = nomePersonalizada.get(b.customCategoryId ?? "") ?? "Personalizada";
      // Personalizada com o mesmo nome de uma categoria-mãe: sem diferenciar, a tela dizia
      // "Alimentação estourou" e "Alimentação dentro do ritmo" ao mesmo tempo.
      const label = rotulosDasMaes.has(nome) ? `${nome} (personalizada)` : nome;
      return { key: b.customCategoryId ?? b.id, label, planejado: Number(b.plannedAmount), gasto: Math.max(0, gastoPorPersonalizada.get(b.customCategoryId ?? "") ?? 0), fixa: false, fixoAutomatico: preCriados.porPersonalizada.get(b.customCategoryId ?? "") ?? 0 };
    });

  const hoje = new Date(Date.UTC(year, month - 1, dia));
  const metas = goals
    .map((g) => {
      const atingida = g.computedCurrentAmount >= Number(g.targetAmount);
      // Meta sem data não tem "atrasada": não há prazo pra cobrar. Entra só no fio, por último.
      if (!g.targetDate) {
        return { id: g.id, nome: g.name, status: atingida ? ("ACHIEVED" as const) : ("NOT_STARTED" as const), quando: "sem data definida", porMes: 0, semData: true };
      }
      const p = computeGoalPlan({ targetAmount: Number(g.targetAmount), currentAmount: g.computedCurrentAmount, targetDate: g.targetDate, annualRate: Number(g.annualRate ?? 0), startedAt: g.createdAt });
      // Vencida só depois que o MÊS do prazo acabou: a meta de viagem guarda o dia 1 como prazo, e
      // "até setembro" não pode virar "o prazo já passou" no dia 2 de setembro.
      const fimDoMesDoPrazo = Date.UTC(g.targetDate.getUTCFullYear(), g.targetDate.getUTCMonth() + 1, 0);
      const vencida = !atingida && fimDoMesDoPrazo < hoje.getTime();
      const ultimoMes = !atingida && !vencida && p.monthsRemaining === 0;
      return { id: g.id, nome: g.name, status: vencida ? ("BEHIND" as const) : p.status, quando: `${MESES[g.targetDate.getUTCMonth()]} de ${g.targetDate.getUTCFullYear()}`, porMes: p.requiredMonthlyContribution, vencida, ultimoMes, semData: false };
    })
    .sort((a, b) => Number(a.semData) - Number(b.semData));

  const m = (v: number) => money(v, { round: true });
  const hrefMes = `/mensal/${year}/${month}`;
  const aportePlanejado = plan && plan.plannedInvestment > 0 ? plan.plannedInvestment : null;
  const empresa = ehEmpresa(ctx.profileKind);
  // O Raio-X é dos "pequenos gastos" de uma pessoa; a empresa não tem Decidir.
  const naoDecididos = empresa ? [] : raiox.itens.filter((i) => !raiox.decididos.has(i.chave));

  const foco = montarFoco({
    ritmo: ritmo ?? "semanal",
    dia,
    diasNoMes,
    categorias,
    gastoDoMes: summary.totalExpense,
    lancouGastoNoMes: gastosReais > 0,
    aportadoNoMes: summary.totalInvestment,
    aportePlanejado,
    diasDesdeUltimoGasto: lastExpense ? Math.max(0, Math.round((hoje.getTime() - lastExpense.getTime()) / DIA_MS)) : null,
    metas,
    reserva: fund && Number(fund.monthlyExpenseBase) > 0 ? { atual: Number(fund.currentAmount), custoMensal: Number(fund.monthlyExpenseBase) } : null,
    // A meta de meses que ELA escolheu na tela da reserva (a mesma que o Painel usa pra dizer
    // "100% concluída"); sem reserva montada, a referência da aula (6) ou do Sebrae (3).
    reservaMinimaMeses: fund && fund.targetMonths > 0 ? fund.targetMonths : empresa ? 3 : 6,
    hrefMes,
    tetos,
    raiox: naoDecididos.length > 0 ? { n: naoDecididos.length, anual: naoDecididos.reduce((s, i) => s + i.anual, 0) } : null,
    money: m,
    t,
  });

  return {
    t,
    m,
    empresa,
    ritmo,
    now,
    year,
    month,
    dia,
    diasNoMes,
    mesLabel: MESES[month - 1],
    mesAnterior,
    semana,
    hrefMes,
    categorias,
    tetos,
    summary,
    aportePlanejado,
    fund,
    // createdAt é um instante real; nowInBrazil() é um relógio deslocado. A conta é com Date.now().
    cancelamentos,
    viradaPendente: !viradaFeita && lancamentosAnoPassado > 0,
    lancamentosParaRevisar: paraRevisar.length,
    pendentes: pendentes.filter((p) => Date.now() - p.createdAt.getTime() > 20 * 3_600_000),
    ritualFeito,
    fechamentoFeito,
    foco,
  };
}
