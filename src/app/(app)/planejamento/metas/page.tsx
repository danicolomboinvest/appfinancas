import { Target } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { computeGoalPlan, type GoalCalcResult } from "@/lib/planning/goal";
import { monthKeyLabel } from "@/lib/planning/goal-checkin";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewGoalButton } from "./NewGoalButton";
import { GoalCard, type GoalVariant } from "./GoalCard";

/**
 * Deriva uma cor de ritmo (adiantada/no ritmo/atrasada) puramente para exibição, sem
 * alterar o cálculo de `computeGoalPlan`. BEHIND/NOT_STARTED viram "atrasada"; entre as
 * metas ON_TRACK, quem já guardou boa parte do valor-alvo aparece como "adiantada".
 */
function resolveVariant(plan: GoalCalcResult, currentAmount: number, targetAmount: number): GoalVariant {
  if (plan.status === "ACHIEVED") return "achieved";
  if (plan.status === "BEHIND" || plan.status === "NOT_STARTED") return "behind";
  const progress = targetAmount > 0 ? currentAmount / targetAmount : 0;
  return progress >= 0.66 ? "ahead" : "onTrack";
}

const VARIANT_RANK: Record<GoalVariant, number> = { behind: 0, onTrack: 1, ahead: 1, achieved: 2 };

export default async function MetasPage() {
  const ctx = await getRequiredSession();
  const goals = await listGoalsWithProgress(ctx);
  const now = nowInBrazil();

  const withPlans = goals.map((goal) => {
    const targetAmount = Number(goal.targetAmount);
    // Progresso REAL (ativos vinculados + aportes), não mais o campo manual, item 6.
    const currentAmount = goal.computedCurrentAmount;
    const targetDate = goal.targetDate ?? new Date();
    const goalInput = {
      targetAmount,
      currentAmount,
      targetDate,
      annualRate: Number(goal.annualRate ?? 0),
    };
    const plan = computeGoalPlan(goalInput);
    const variant = resolveVariant(plan, currentAmount, targetAmount);

    // Marcar o aporte do mês fica SEMPRE disponível numa meta ativa com aporte sugerido — não
    // só na janela do dia 25 ao 7. Aquela janela servia para uma pergunta ("fez o aporte?"),
    // que não cabe no meio do mês; aqui é um botão, e o dinheiro sai da conta no dia 10.
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const checkin =
      variant !== "achieved" && plan.requiredMonthlyContribution > 0
        ? {
            monthKey,
            monthLabel: monthKeyLabel(monthKey),
            suggestedAmount: plan.requiredMonthlyContribution,
            done: goal.checkinDismissedMonth === monthKey,
          }
        : null;

    return {
      goal,
      plan,
      targetAmount,
      currentAmount,
      targetDate,
      variant,
      checkin,
    };
  });

  // Pior status primeiro (atrasada > no ritmo/adiantada), concluídas sempre por último;
  // dentro do mesmo grupo, prazo mais próximo primeiro.
  const sorted = [...withPlans].sort((a, b) => {
    const rankDiff = VARIANT_RANK[a.variant] - VARIANT_RANK[b.variant];
    if (rankDiff !== 0) return rankDiff;
    const dateA = a.goal.targetDate?.getTime() ?? Infinity;
    const dateB = b.goal.targetDate?.getTime() ?? Infinity;
    return dateA - dateB;
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Metas"
        subtitle="Cadastre metas com prazo e veja quanto precisa aportar por mês para chegar lá."
        action={<NewGoalButton />}
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Target}
          message="Nenhuma meta cadastrada ainda. Crie a primeira e veja quanto precisa guardar por mês para chegar lá."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(({ goal, plan, targetAmount, currentAmount, targetDate, variant, checkin }) => (
            <GoalCard
              key={goal.id}
              id={goal.id}
              name={goal.name}
              icon={goal.icon}
              targetAmount={targetAmount}
              currentAmount={currentAmount}
              targetDate={targetDate}
              annualRate={Number(goal.annualRate ?? 0)}
              plan={plan}
              variant={variant}
              checkin={checkin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
