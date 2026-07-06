import Link from "next/link";
import { ShieldCheck, Target, Sparkles } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { LinkedStatCard } from "@/components/ui/LinkedStatCard";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Variação percentual entre o mês atual e o anterior — null quando não dá para comparar (mês anterior zerado). */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export default async function DashboardPage() {
  const ctx = await getRequiredSession();
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const previousMonthDate = new Date(year, currentMonth - 2, 1);

  const [summary, portfolio, emergencyFund, goals, planningParams, currentMonthSummary, previousMonthSummary] =
    await Promise.all([
      getYearlySummary(ctx, year),
      getPortfolioByObjective(ctx),
      getEmergencyFund(ctx),
      listGoals(ctx),
      getPlanningParams(ctx),
      getMonthlySummary(ctx, year, currentMonth),
      getMonthlySummary(ctx, previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1),
    ]);

  const incomeTrend = changePercent(currentMonthSummary.totalIncome, previousMonthSummary.totalIncome);
  const expenseTrend = changePercent(currentMonthSummary.totalExpense, previousMonthSummary.totalExpense);
  const investmentTrend = changePercent(currentMonthSummary.totalInvestment, previousMonthSummary.totalInvestment);
  const balanceTrend = changePercent(currentMonthSummary.balance, previousMonthSummary.balance);

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
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Patrimônio total" value={formatBRL(portfolio.totalPortfolio)} tone="accent" />
        <StatCard
          label="Renda no ano"
          value={formatBRL(summary.totalIncome)}
          tone="success"
          trend={incomeTrend === null ? undefined : { percent: incomeTrend, periodLabel: "mês passado" }}
        />
        <StatCard
          label="Gastos no ano"
          value={formatBRL(summary.totalExpense)}
          tone="danger"
          trend={
            expenseTrend === null ? undefined : { percent: expenseTrend, periodLabel: "mês passado", goodDirection: "down" }
          }
        />
        <StatCard
          label="Aportes no ano"
          value={formatBRL(summary.totalInvestment)}
          trend={investmentTrend === null ? undefined : { percent: investmentTrend, periodLabel: "mês passado" }}
        />
        <StatCard
          label="Saldo no ano"
          value={formatBRL(summary.balance)}
          trend={balanceTrend === null ? undefined : { percent: balanceTrend, periodLabel: "mês passado" }}
        />
        <StatCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : `${(summary.savingsRate * 100).toFixed(1)}%`}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Status dos módulos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LinkedStatCard
            href="/planejamento/reserva-emergencia"
            icon={ShieldCheck}
            label="Reserva de emergência"
            value={emergencyProgress === null ? "Não configurada" : `${Math.round(emergencyProgress * 100)}% concluída`}
            hint={emergencyTarget !== null ? `${formatBRL(emergencyCurrent)} de ${formatBRL(emergencyTarget)}` : "Configure sua meta"}
            progressPercent={emergencyProgress ?? undefined}
            tone={emergencyProgress !== null && emergencyProgress >= 1 ? "success" : "accent"}
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
            href="/planejamento/usufruto"
            icon={Sparkles}
            label="Liberdade Financeira"
            value={usufructSurplus === null ? "Não configurada" : formatBRL(usufructSurplus)}
            hint={
              usufructSurplus === null
                ? "Configure seu planejamento"
                : usufructSurplus >= 0
                  ? "Superávit: renda passiva cobre o padrão de vida desejado"
                  : "Déficit: falta patrimônio para o padrão de vida desejado"
            }
            tone={usufructSurplus === null ? "neutral" : usufructSurplus >= 0 ? "success" : "danger"}
          />
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Renda, gastos e aportes por mês</h2>
        <YearlyBarChart months={summary.months} />
      </Card>
    </div>
  );
}
