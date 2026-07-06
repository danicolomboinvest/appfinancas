import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnGoal } from "@/lib/repositories/goal.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GoalForm } from "../GoalForm";
import { DeleteGoalButton } from "../DeleteGoalButton";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Sem prazo hábil",
  ON_TRACK: "Em progresso",
  BEHIND: "Atrasada",
  ACHIEVED: "Concluída",
};

export default async function GoalDetailPage(props: PageProps<"/planejamento/metas/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const goal = await getOwnGoal(ctx, id);

  if (!goal) {
    notFound();
  }

  const targetDate = goal.targetDate ?? new Date();
  const plan = computeGoalPlan({
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
    targetDate,
    annualRate: Number(goal.annualRate ?? 0),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Está no caminho certo?", href: "/planejamento/acumulo" },
          { label: "Metas", href: "/planejamento/metas" },
          { label: goal.name },
        ]}
      />

      <PageHeader title={goal.name} action={<DeleteGoalButton id={goal.id} />} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Status" value={STATUS_LABEL[plan.status]} tone="accent" />
        <StatCard label="Meses restantes" value={`${plan.monthsRemaining}`} />
        <StatCard label="Valor guardado projetado na data-alvo" value={formatBRL(plan.futureValueOfSaved)} />
        <StatCard label="Falta construir" value={formatBRL(plan.amountMissing)} tone="danger" />
        <StatCard label="Aporte mensal sugerido" value={formatBRL(plan.requiredMonthlyContribution)} tone="success" />
      </div>

      <GoalForm
        goalId={goal.id}
        submitLabel="Salvar alterações"
        defaults={{
          name: goal.name,
          targetAmount: Number(goal.targetAmount),
          currentAmount: Number(goal.currentAmount),
          annualRate: Number(goal.annualRate ?? 0),
          targetDate: targetDate.toISOString().slice(0, 10),
          icon: goal.icon,
        }}
      />
    </div>
  );
}
