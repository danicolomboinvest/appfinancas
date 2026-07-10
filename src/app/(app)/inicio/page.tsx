import { PiggyBank, ShieldCheck, Target, Wallet } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getAnnualPlannedVsActual } from "@/lib/planning/budget-comparison";
import { computeDailySpendingLimit, computeDaysRemainingInMonth } from "@/lib/planning/daily-limit";
import { listGoals } from "@/lib/repositories/goal.repo";
import { computeGoalPlan, type GoalCalcResult } from "@/lib/planning/goal";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { TappableSummaryCard } from "@/components/ui/TappableSummaryCard";
import { EmptyState } from "@/components/ui/EmptyState";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesma prioridade da tela Metas: atrasada primeiro, concluída por último. */
function resolveGoalRank(plan: GoalCalcResult): number {
  if (plan.status === "ACHIEVED") return 2;
  if (plan.status === "BEHIND" || plan.status === "NOT_STARTED") return 0;
  return 1;
}

export default async function ResumoPage() {
  const ctx = await getRequiredSession();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [comparison, goals, fund] = await Promise.all([
    getAnnualPlannedVsActual(ctx, year),
    listGoals(ctx),
    getEmergencyFund(ctx),
  ]);

  const currentMonthData = comparison.months.find((m) => m.month === month);
  const daysRemaining = computeDaysRemainingInMonth(now);
  const dailyLimit =
    currentMonthData && currentMonthData.totalPlanned > 0
      ? computeDailySpendingLimit(currentMonthData.totalPlanned, currentMonthData.totalSpent, daysRemaining)
      : null;
  const isOverBudget = dailyLimit !== null && dailyLimit < 0;

  const rankedGoals = goals
    .map((goal) => {
      const targetAmount = Number(goal.targetAmount);
      const currentAmount = Number(goal.currentAmount);
      const plan = computeGoalPlan({
        targetAmount,
        currentAmount,
        targetDate: goal.targetDate ?? new Date(),
        annualRate: Number(goal.annualRate ?? 0),
      });
      return { goal, plan, targetAmount, currentAmount, rank: resolveGoalRank(plan) };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2);

  const hasAnyGoalContent = Boolean(fund) || rankedGoals.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <TappableSummaryCard
        href="/orcamento"
        icon={Wallet}
        title="Orçamento"
        size="hero"
        heroTone={isOverBudget ? "danger" : "accent"}
        value={
          dailyLimit === null
            ? "Defina seu orçamento"
            : isOverBudget
              ? `Estourou ${formatBRL(Math.abs(dailyLimit))}/dia`
              : `Você tem ${formatBRL(dailyLimit)} pra gastar hoje`
        }
        hint={
          dailyLimit === null
            ? "Planeje quanto quer gastar por categoria pra ver seu limite diário."
            : `${formatBRL(currentMonthData?.totalSpent ?? 0)} de ${formatBRL(currentMonthData?.totalPlanned ?? 0)} gastos este mês`
        }
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink-muted">Metas</h2>

        {!hasAnyGoalContent ? (
          <EmptyState
            icon={Target}
            message="Nenhuma meta cadastrada ainda. Crie a primeira e acompanhe o progresso por aqui."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {fund && (
              <TappableSummaryCard
                href="/planejamento/reserva-emergencia"
                icon={ShieldCheck}
                title="Reserva de emergência"
                value={`${formatBRL(Number(fund.currentAmount))} / ${formatBRL(Number(fund.targetAmount))}`}
                progressPercent={Number(fund.targetAmount) > 0 ? Number(fund.currentAmount) / Number(fund.targetAmount) : 0}
                progressTone={Number(fund.currentAmount) >= Number(fund.targetAmount) ? "accent" : "success"}
              />
            )}

            {rankedGoals.map(({ goal, targetAmount, currentAmount, plan }) => (
              <TappableSummaryCard
                key={goal.id}
                href={`/planejamento/metas/${goal.id}`}
                icon={PiggyBank}
                title={goal.name}
                value={`${formatBRL(currentAmount)} / ${formatBRL(targetAmount)}`}
                progressPercent={targetAmount > 0 ? currentAmount / targetAmount : 0}
                progressTone={plan.status === "ACHIEVED" ? "accent" : plan.status === "BEHIND" ? "danger" : "success"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
