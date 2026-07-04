import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listGoals } from "@/lib/repositories/goal.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { GoalForm } from "./GoalForm";
import { DeleteGoalButton } from "./DeleteGoalButton";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "danger" | "gold" }> = {
  NOT_STARTED: { label: "Sem prazo hábil", tone: "neutral" },
  ON_TRACK: { label: "Em progresso", tone: "gold" },
  BEHIND: { label: "Atrasada", tone: "danger" },
  ACHIEVED: { label: "Concluída", tone: "success" },
};

export default async function MetasPage() {
  const ctx = await getRequiredSession();
  const goals = await listGoals(ctx);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Metas" subtitle="Cadastre metas com prazo e veja quanto precisa aportar por mês para chegar lá." />

      <GoalForm defaults={{}} submitLabel="Adicionar meta" />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Meta</th>
              <th className="px-4 py-3 font-medium">Alvo</th>
              <th className="px-4 py-3 font-medium">Guardado</th>
              <th className="px-4 py-3 font-medium">Data-alvo</th>
              <th className="px-4 py-3 font-medium">Aporte mensal sugerido</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => {
              const plan = computeGoalPlan({
                targetAmount: Number(goal.targetAmount),
                currentAmount: Number(goal.currentAmount),
                targetDate: goal.targetDate ?? new Date(),
                annualRate: Number(goal.annualRate ?? 0),
              });
              const status = STATUS[plan.status];
              return (
                <tr key={goal.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <Link href={`/planejamento/metas/${goal.id}`} className="font-medium text-gold-strong hover:underline">
                      {goal.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatBRL(Number(goal.targetAmount))}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatBRL(Number(goal.currentAmount))}</td>
                  <td className="px-4 py-3 text-ink-muted">{goal.targetDate?.toLocaleDateString("pt-BR") ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{formatBRL(plan.requiredMonthlyContribution)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <DeleteGoalButton id={goal.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {goals.length === 0 && <EmptyState message="Nenhuma meta cadastrada ainda." />}
      </Card>
    </div>
  );
}
