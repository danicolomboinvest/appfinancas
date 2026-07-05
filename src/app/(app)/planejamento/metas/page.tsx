import { getRequiredSession } from "@/lib/auth/session";
import { listGoals } from "@/lib/repositories/goal.repo";
import { computeGoalPlan, type GoalCalcResult } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { GoalForm } from "./GoalForm";
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
  const goals = await listGoals(ctx);

  const withPlans = goals.map((goal) => {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const plan = computeGoalPlan({
      targetAmount,
      currentAmount,
      targetDate: goal.targetDate ?? new Date(),
      annualRate: Number(goal.annualRate ?? 0),
    });
    return { goal, plan, targetAmount, currentAmount, variant: resolveVariant(plan, currentAmount, targetAmount) };
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
      <PageHeader title="Metas" subtitle="Cadastre metas com prazo e veja quanto precisa aportar por mês para chegar lá." />

      <GoalForm defaults={{}} submitLabel="Adicionar meta" />

      {sorted.length === 0 ? (
        <EmptyState message="Nenhuma meta cadastrada ainda." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(({ goal, plan, targetAmount, currentAmount, variant }) => (
            <GoalCard
              key={goal.id}
              id={goal.id}
              name={goal.name}
              targetAmount={targetAmount}
              currentAmount={currentAmount}
              plan={plan}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
