import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPortfolioByObjective, getAllocationByClass } from "@/lib/consolidation/portfolio";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

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
      <PageHeader
        title="Carteira por Objetivo"
        subtitle={
          <>
            Posição atual por objetivo e alocação atual vs. ideal por classe.{" "}
            <Link href="/carteira" className="text-gold-strong hover:underline">
              ← editar ativos
            </Link>
          </>
        }
      />

      <div>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Posição por objetivo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total da carteira" value={formatBRL(byObjective.totalPortfolio)} tone="gold" />
          <StatCard
            label="Reserva de emergência"
            value={formatBRL(byObjective.reserva.currentValue)}
            hint={
              byObjective.reserva.targetAmount !== null
                ? `${formatPercent(byObjective.reserva.achievementPercent)} da meta (${formatBRL(byObjective.reserva.targetAmount)})`
                : "Sem meta cadastrada em Reserva de Emergência"
            }
          />
          <StatCard label="Liberdade financeira" value={formatBRL(byObjective.liberdade.currentValue)} />
          <StatCard label="Sem objetivo definido" value={formatBRL(byObjective.outro.currentValue)} />
        </div>
      </div>

      {byObjective.metas.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Metas</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
                  <th className="px-4 py-3 font-medium">Meta</th>
                  <th className="px-4 py-3 font-medium">Alocado</th>
                  <th className="px-4 py-3 font-medium">Alvo</th>
                  <th className="px-4 py-3 font-medium">Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {byObjective.metas.map((goal) => (
                  <tr key={goal.goalId} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <Link href={`/planejamento/metas/${goal.goalId}`} className="font-medium text-gold-strong hover:underline">
                        {goal.goalName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatBRL(goal.currentValue)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatBRL(goal.targetAmount)}</td>
                    <td className="px-4 py-3 text-ink">{formatPercent(goal.achievementPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Alocação atual vs. ideal por classe</h2>
        {allocation.classes.length === 0 ? (
          <p className="text-sm text-ink-faint">Nenhum ativo cadastrado ainda.</p>
        ) : (
          <Card className="p-5">
            <AllocationChart classes={allocation.classes} />
          </Card>
        )}
      </div>
    </div>
  );
}
