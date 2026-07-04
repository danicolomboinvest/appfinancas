import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listGoals } from "@/lib/repositories/goal.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { GoalForm } from "./GoalForm";
import { DeleteGoalButton } from "./DeleteGoalButton";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Sem prazo hábil",
  ON_TRACK: "Em progresso",
  BEHIND: "Atrasada",
  ACHIEVED: "Concluída",
};

export default async function MetasPage() {
  const ctx = await getRequiredSession();
  const goals = await listGoals(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Metas</h1>
        <p className="mt-1 text-sm text-black/60">Cadastre metas com prazo e veja quanto precisa aportar por mês para chegar lá.</p>
      </div>

      <GoalForm defaults={{}} submitLabel="Adicionar meta" />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Meta</th>
            <th className="py-2">Alvo</th>
            <th className="py-2">Guardado</th>
            <th className="py-2">Data-alvo</th>
            <th className="py-2">Aporte mensal sugerido</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
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
            return (
              <tr key={goal.id} className="border-b border-black/5">
                <td className="py-2">
                  <Link href={`/planejamento/metas/${goal.id}`} className="underline">
                    {goal.name}
                  </Link>
                </td>
                <td className="py-2">{formatBRL(Number(goal.targetAmount))}</td>
                <td className="py-2">{formatBRL(Number(goal.currentAmount))}</td>
                <td className="py-2">{goal.targetDate?.toLocaleDateString("pt-BR") ?? "—"}</td>
                <td className="py-2">{formatBRL(plan.requiredMonthlyContribution)}</td>
                <td className="py-2">{STATUS_LABEL[plan.status]}</td>
                <td className="py-2">
                  <DeleteGoalButton id={goal.id} />
                </td>
              </tr>
            );
          })}
          {goals.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-black/40">
                Nenhuma meta cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
