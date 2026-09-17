import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getGoalWithProgress } from "@/lib/repositories/goal.repo";
import { computeGoalPlan, computeGoalTrajectory } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatRows } from "@/components/ui/StatRows";
import { Card } from "@/components/ui/Card";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GoalForm } from "../GoalForm";
import { DeleteGoalButton } from "../DeleteGoalButton";
import { GoalTrajectoryChart } from "../GoalTrajectoryChart";
import { serverMoney } from "@/lib/money-server";

const STATUS_CHART_TONE: Record<string, "success" | "accent" | "danger"> = {
  NOT_STARTED: "danger",
  ON_TRACK: "accent",
  BEHIND: "danger",
  ACHIEVED: "success",
};


const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Sem prazo hábil",
  ON_TRACK: "Em progresso",
  BEHIND: "Atrasada",
  ACHIEVED: "Concluída",
};

export default async function GoalDetailPage(props: PageProps<"/planejamento/metas/[id]">) {
  const money = await serverMoney();
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const goal = await getGoalWithProgress(ctx, id);

  if (!goal) {
    notFound();
  }

  const targetDate = goal.targetDate ?? new Date();
  const goalInput = {
    targetAmount: Number(goal.targetAmount),
    currentAmount: goal.computedCurrentAmount,
    targetDate,
    annualRate: Number(goal.annualRate ?? 0),
      startedAt: goal.createdAt,
  };
  const plan = computeGoalPlan(goalInput);
  const trajectory = computeGoalTrajectory(goalInput, plan);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Planejamento Financeiro", href: "/planejamento/acumulo" },
          { label: "Metas", href: "/planejamento/metas" },
          { label: goal.name },
        ]}
      />

      <PageHeader title={goal.name} action={<DeleteGoalButton id={goal.id} />} />

      {/* Quatro, não cinco: "valor guardado projetado na data-alvo" era o próprio valor
          guardado quando a taxa é zero — um número a mais pra explicar, e o quinto card
          ficava órfão na grade de dois do celular. */}
      <StatRows
        items={[
          {
            label: "Ritmo",
            value: STATUS_LABEL[plan.status],
            tone: plan.status === "BEHIND" ? "danger" : plan.status === "ACHIEVED" ? "success" : "accent",
          },
          { label: "Meses restantes", value: `${plan.monthsRemaining}` },
          { label: "Falta guardar", value: money(plan.amountMissing), tone: "danger" },
          { label: "Guardar por mês", value: money(plan.requiredMonthlyContribution), tone: "success" },
        ]}
      />

      <Card className="p-5">
        <p className="mb-2 text-xs font-medium text-ink-muted">Trajetória projetada até a meta</p>
        <GoalTrajectoryChart
          data={trajectory}
          targetAmount={Number(goal.targetAmount)}
          tone={STATUS_CHART_TONE[plan.status]}
        />
      </Card>

      <Card className="p-4">
        <GoalForm
          goalId={goal.id}
          submitLabel="Salvar alterações"
          defaults={{
            name: goal.name,
            targetAmount: Number(goal.targetAmount),
            currentAmount: goal.computedCurrentAmount,
            annualRate: Number(goal.annualRate ?? 0),
            targetDate: targetDate.toISOString().slice(0, 10),
            icon: goal.icon,
          }}
        />
      </Card>
    </div>
  );
}
