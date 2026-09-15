import Link from "next/link";
import { ShieldCheck, Target, Sparkles, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { sumUpcomingDividends } from "@/lib/repositories/dividend.repo";
import { getAnnualPlannedVsActual, compareCategoryBudget } from "@/lib/planning/budget-comparison";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { countRecentDatedEntries } from "@/lib/repositories/monthly-entry.repo";
import { buildWeeklyTasks } from "@/lib/insights/weekly-tasks";
import { WeeklyTasksCard } from "@/components/shell/WeeklyTasksCard";
import { computeGoalPlan } from "@/lib/planning/goal";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { FitText } from "@/components/ui/FitText";
import { CountUp } from "@/components/ui/CountUp";
import { LinkedStatCard } from "@/components/ui/LinkedStatCard";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];


/** Variação percentual entre o mês atual e o anterior, null quando não dá para comparar (mês anterior zerado). */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * Diferença em R$ entre o mês atual e o anterior, usada só para o saldo, em vez de %.
 * Perto de zero (ou quando não há renda no mês), o saldo tende a ficar bem próximo do gasto
 * invertido (saldo = renda - gastos - aportes, e com renda/aportes zerados vira -gastos), o
 * que faz a variação percentual do saldo coincidir com a dos gastos por pura matemática —
 * parecendo um bug de "número repetido" sem ser. Um delta em R$ não sofre dessa ilusão.
 */
function changeAmount(current: number, previous: number): number | null {
  if (current === previous) return null;
  return current - previous;
}

function firstOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const money = await serverMoney();
  const searchParams = await props.searchParams;
  const ctx = await getRequiredSession();
  // Fuso do Brasil, o relógio UTC do servidor viraria o ano mais cedo na noite de 31/12.
  const now = nowInBrazil();

  // Ano selecionável via ?year, as setas do cabeçalho navegam por aqui.
  const yearParam = Number(firstOf(searchParams.year));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getFullYear();
  const isCurrentYear = year === now.getFullYear();

  // Mês de referência da comparação "vs mês passado": o mês atual no ano corrente; em anos
  // passados, dezembro (último mês fechado do ano).
  const currentMonth = isCurrentYear ? now.getMonth() + 1 : 12;
  const previousMonthDate = new Date(year, currentMonth - 2, 1);

  const [
    summary,
    portfolio,
    emergencyFund,
    goals,
    planningParams,
    currentMonthSummary,
    previousMonthSummary,
    plannedVsActual,
    upcomingDividends,
    entriesThisWeek,
    monthBudgets,
    spentByParent,
    spentByCustom,
  ] = await Promise.all([
    getYearlySummary(ctx, year),
    getPortfolioByObjective(ctx),
    getEmergencyFund(ctx),
    listGoals(ctx),
    getPlanningParams(ctx),
    getMonthlySummary(ctx, year, currentMonth),
    getMonthlySummary(ctx, previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1),
    getAnnualPlannedVsActual(ctx, year),
    sumUpcomingDividends(ctx, 30),
    countRecentDatedEntries(ctx, 7),
    listBudgets(ctx, year, currentMonth),
    sumExpensesByParentCategory(ctx, year, currentMonth),
    sumExpensesByCustomCategory(ctx, year, currentMonth),
  ]);

  const plannedByMonth = Object.fromEntries(
    plannedVsActual.months.map((m) => [m.month, m.totalPlanned]),
  ) as Record<number, number>;

  const incomeTrend = changePercent(currentMonthSummary.totalIncome, previousMonthSummary.totalIncome);
  const expenseTrend = changePercent(currentMonthSummary.totalExpense, previousMonthSummary.totalExpense);
  const balanceDelta = changeAmount(currentMonthSummary.balance, previousMonthSummary.balance);

  const monthsSoFar = summary.months.filter((m) => m.isRealized);
  const incomeSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.totalIncome }));
  const expenseSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.totalExpense }));
  const balanceSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.balance }));

  const emergencyTarget = emergencyFund ? Number(emergencyFund.targetAmount) : null;
  const emergencyCurrent = emergencyFund ? Number(emergencyFund.currentAmount) : 0;
  const emergencyProgress = emergencyTarget && emergencyTarget > 0 ? emergencyCurrent / emergencyTarget : null;

  const goalStatuses = goals.map((goal) =>
    computeGoalPlan({
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate ?? new Date(),
      annualRate: Number(goal.annualRate ?? 0),
    }).status,
  );
  const goalsOnTrack = goalStatuses.filter((status) => status === "ON_TRACK" || status === "ACHIEVED").length;
  const goalsBehind = goalStatuses.filter((status) => status === "BEHIND" || status === "NOT_STARTED").length;

  // Checklist da semana: quantas categorias já passaram do que foi planejado no mês corrente.
  // Gasto de categoria sem plano não conta como "estouro" — não havia teto pra estourar.
  const spentByKey = new Map<string, number>([
    ...spentByParent.map((s) => [`parent:${s.parentCategory}`, s.spent] as const),
    ...spentByCustom.map((s) => [`custom:${s.customCategoryId}`, s.spent] as const),
  ]);
  const overBudgetCount = monthBudgets.filter((budget) => {
    const key = budget.parentCategory
      ? `parent:${budget.parentCategory}`
      : budget.customCategoryId
        ? `custom:${budget.customCategoryId}`
        : null;
    if (!key) return false;
    return compareCategoryBudget(Number(budget.plannedAmount), spentByKey.get(key) ?? 0).status === "ACIMA";
  }).length;

  const weeklyTasks = buildWeeklyTasks({
    entriesThisWeek,
    hasBudget: monthBudgets.some((b) => Number(b.plannedAmount) > 0),
    overBudgetCount,
    emergencyProgress,
    goalCount: goals.length,
    goalsBehind,
    investedThisMonth: currentMonthSummary.totalInvestment,
  });

  let usufructSurplus: number | null = null;
  if (planningParams) {
    const accumulation = computeAccumulation({
      currentAge: planningParams.currentAge,
      retirementAge: planningParams.retirementAge,
      currentPatrimony: Number(planningParams.currentPatrimony),
      monthlyContributionAccumulation: Number(planningParams.monthlyContributionAccumulation),
      accumulationAnnualRate: Number(planningParams.accumulationAnnualRate),
      inflationAnnualRate: Number(planningParams.inflationAnnualRate),
    });
    const usufruct = computeUsufruct({
      finalValueReal: accumulation.finalValueReal,
      usufructAnnualRate: Number(planningParams.usufructAnnualRate),
      otherPassiveIncome: Number(planningParams.otherPassiveIncome),
      desiredPassiveIncome: Number(planningParams.desiredPassiveIncome),
    });
    usufructSurplus = usufruct.surplusOrDeficit;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Visão Geral"
        subtitle={
          <>
            Consolidado de {year}.{" "}
            <Link href={`/mensal/${year}`} className="text-accent-strong hover:underline">
              Ver Fluxo Financeiro
            </Link>
          </>
        }
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard?year=${year - 1}`}
              aria-label={`Ano ${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/dashboard?year=${year + 1}`}
              aria-label={`Ano ${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <div className="glow-stage rounded-3xl p-4 sm:p-5">
        <Card className="p-6">
          <p className="text-label text-ink-muted">Patrimônio total</p>
          <div className="mt-1">
            <FitText className="text-display font-semibold tracking-tight text-accent-strong">
              {/* `brl` (não `format={formatBRL}`): função não atravessa a fronteira server→client. */}
              <CountUp value={portfolio.totalPortfolio} brl />
            </FitText>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Renda no ano"
          value={money(summary.totalIncome)}
          tone="success"
          trend={incomeTrend === null ? undefined : { percent: incomeTrend, periodLabel: "mês passado" }}
          sparkline={incomeSparkline}
        />
        <StatCard
          label="Gastos no ano"
          value={money(summary.totalExpense)}
          tone="neutral"
          trend={
            expenseTrend === null ? undefined : { percent: expenseTrend, periodLabel: "mês passado", goodDirection: "down" }
          }
          sparkline={expenseSparkline}
        />
        <StatCard
          label="Saldo no ano"
          value={money(summary.balance)}
          tone="accent"
          hint={
            summary.savingsRate === null
              ? undefined
              : `Taxa de poupança: ${formatPercentNumber(summary.savingsRate * 100, 1)}`
          }
          trend={
            balanceDelta === null
              ? undefined
              : { percent: balanceDelta, periodLabel: "mês passado", displayValue: money(Math.abs(balanceDelta)) }
          }
          sparkline={balanceSparkline}
        />
      </div>

      {/* Próximos passos antes do status: o painel dizia como as coisas ESTÃO, mas não o que
          fazer a seguir — e é aí que a maioria abre o app, olha, e não volta. */}
      {isCurrentYear && <WeeklyTasksCard tasks={weeklyTasks} />}

      <div>
        <h2 className="mb-3 text-h2 font-semibold tracking-tight text-ink">Status dos módulos</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LinkedStatCard
            href="/planejamento/reserva-emergencia"
            icon={ShieldCheck}
            label="Reserva de emergência"
            value={emergencyProgress === null ? "Não configurada" : `${Math.round(emergencyProgress * 100)}% concluída`}
            hint={emergencyTarget !== null ? `${money(emergencyCurrent)} de ${money(emergencyTarget)}` : "Configure sua meta"}
            progressPercent={emergencyProgress ?? undefined}
            tone={emergencyProgress === null ? "neutral" : emergencyProgress >= 1 ? "accent" : "success"}
          />
          <LinkedStatCard
            href="/planejamento/metas"
            icon={Target}
            label="Metas"
            value={goals.length === 0 ? "Nenhuma meta" : `${goalsOnTrack} no ritmo · ${goalsBehind} atrasadas`}
            hint={goals.length === 0 ? "Cadastre sua primeira meta" : `${goals.length} meta${goals.length === 1 ? "" : "s"} no total`}
            tone={goalsBehind > 0 ? "danger" : "success"}
          />
          <LinkedStatCard
            href="/planejamento/acumulo#liberdade-financeira"
            icon={Sparkles}
            label="Aposentadoria"
            value={usufructSurplus === null ? "Não configurada" : money(usufructSurplus)}
            hint={
              usufructSurplus === null
                ? "Configure seu planejamento"
                : usufructSurplus >= 0
                  ? "Superávit: renda passiva cobre o padrão de vida desejado"
                  : "Déficit: falta patrimônio para o padrão de vida desejado"
            }
            tone={usufructSurplus === null ? "neutral" : usufructSurplus >= 0 ? "success" : "danger"}
          />
          <LinkedStatCard
            href="/carteira#dividendos"
            icon={Coins}
            label="Dividendos (30 dias)"
            value={upcomingDividends > 0 ? money(upcomingDividends) : "Nenhum previsto"}
            hint={upcomingDividends > 0 ? "Estimativa dos ativos da sua carteira" : "Aparece quando houver provento anunciado"}
            tone={upcomingDividends > 0 ? "success" : "neutral"}
          />
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Renda, gastos e aportes por mês</h2>
        <YearlyBarChart months={summary.months} plannedByMonth={plannedByMonth} />
      </Card>
    </div>
  );
}
