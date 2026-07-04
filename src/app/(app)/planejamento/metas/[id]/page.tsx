import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnGoal } from "@/lib/repositories/goal.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{goal.name}</h1>
          <Link href="/planejamento/metas" className="text-sm underline">
            ← todas as metas
          </Link>
        </div>
        <DeleteGoalButton id={goal.id} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Status" value={STATUS_LABEL[plan.status]} />
        <SummaryCard label="Meses restantes" value={`${plan.monthsRemaining}`} />
        <SummaryCard label="Valor guardado projetado na data-alvo" value={formatBRL(plan.futureValueOfSaved)} />
        <SummaryCard label="Falta construir" value={formatBRL(plan.amountMissing)} />
        <SummaryCard label="Aporte mensal sugerido" value={formatBRL(plan.requiredMonthlyContribution)} />
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
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-xs text-black/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
