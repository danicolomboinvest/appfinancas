import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPortfolioByObjective, getAllocationByClass } from "@/lib/consolidation/portfolio";
import { AllocationChart } from "@/components/charts/AllocationChart";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export default async function CarteiraPorObjetivoPage() {
  const ctx = await getRequiredSession();
  const [byObjective, allocation] = await Promise.all([getPortfolioByObjective(ctx), getAllocationByClass(ctx)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Carteira por objetivo</h1>
        <p className="mt-1 text-sm text-black/60">
          Posição atual por objetivo (equivalente ao SUMIF da planilha) e alocação atual vs. ideal por classe.{" "}
          <Link href="/carteira" className="underline">
            ← editar ativos
          </Link>
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Posição por objetivo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total da carteira" value={formatBRL(byObjective.totalPortfolio)} />
          <SummaryCard
            label="Reserva de emergência"
            value={formatBRL(byObjective.reserva.currentValue)}
            hint={
              byObjective.reserva.targetAmount !== null
                ? `${formatPercent(byObjective.reserva.achievementPercent)} da meta (${formatBRL(byObjective.reserva.targetAmount)})`
                : "Sem meta cadastrada em Reserva de Emergência"
            }
          />
          <SummaryCard label="Liberdade financeira" value={formatBRL(byObjective.liberdade.currentValue)} />
          <SummaryCard label="Sem objetivo definido" value={formatBRL(byObjective.outro.currentValue)} />
        </div>
      </div>

      {byObjective.metas.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Metas</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/60">
                <th className="py-2">Meta</th>
                <th className="py-2">Alocado</th>
                <th className="py-2">Alvo</th>
                <th className="py-2">Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {byObjective.metas.map((goal) => (
                <tr key={goal.goalId} className="border-b border-black/5">
                  <td className="py-2">
                    <Link href={`/planejamento/metas/${goal.goalId}`} className="underline">
                      {goal.goalName}
                    </Link>
                  </td>
                  <td className="py-2">{formatBRL(goal.currentValue)}</td>
                  <td className="py-2">{formatBRL(goal.targetAmount)}</td>
                  <td className="py-2">{formatPercent(goal.achievementPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Alocação atual vs. ideal por classe</h2>
        {allocation.classes.length === 0 ? (
          <p className="text-sm text-black/60">Nenhum ativo cadastrado ainda.</p>
        ) : (
          <AllocationChart classes={allocation.classes} />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-xs text-black/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-black/50">{hint}</p>}
    </div>
  );
}
