import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPortfolioByObjective, getAllocationByClass } from "@/lib/consolidation/portfolio";
import { getPortfolioStrategyComparison } from "@/lib/portfolio/strategy";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import type { GoalAllocation } from "@/lib/consolidation/portfolio";
import { StrategyComparisonSection } from "./StrategyComparisonSection";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return formatPercentNumber(value * 100, 1);
}

export default async function CarteiraPorObjetivoPage() {
  const ctx = await getRequiredSession();
  const [byObjective, allocation, strategyComparison] = await Promise.all([
    getPortfolioByObjective(ctx),
    getAllocationByClass(ctx),
    getPortfolioStrategyComparison(ctx),
  ]);
  const hasStrategy = strategyComparison.positions.some((p) => p.targetPercent > 0);

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb items={[{ label: "Carteira de Investimentos", href: "/carteira" }, { label: "Por Objetivo" }]} />

      <PageHeader
        title="Carteira por Objetivo"
        subtitle={
          <>
            Posição atual por objetivo e alocação atual vs. ideal por classe.{" "}
            <Link href="/carteira" className="text-accent-strong hover:underline">
              ← editar ativos
            </Link>
          </>
        }
      />

      <div>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Posição por objetivo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total da carteira" value={formatBRL(byObjective.totalPortfolio)} tone="accent" />
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
          <ResponsiveTable columns={goalColumns} rows={byObjective.metas} rowKey={(goal) => goal.goalId} />
        </div>
      )}

      <div>
        <h2 className="mb-3 flex items-center justify-between text-sm font-medium text-ink-muted">
          <span>Carteira atual vs. estratégia-alvo e rebalanceamento</span>
          <Link href="/carteira/estrategia" className="text-xs text-accent-strong hover:underline">
            {hasStrategy ? "Editar estratégia" : "Definir estratégia"} →
          </Link>
        </h2>
        <StrategyComparisonSection positions={strategyComparison.positions} hasStrategy={hasStrategy} />
      </div>

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

const goalColumns: ResponsiveColumn<GoalAllocation>[] = [
  {
    key: "name",
    label: "Meta",
    render: (goal) => (
      <Link href={`/planejamento/metas/${goal.goalId}`} className="font-medium text-accent-strong hover:underline">
        {goal.goalName}
      </Link>
    ),
  },
  { key: "current", label: "Alocado", render: (goal) => formatBRL(goal.currentValue) },
  { key: "target", label: "Alvo", render: (goal) => formatBRL(goal.targetAmount) },
  { key: "achievement", label: "Atingimento", render: (goal) => formatPercent(goal.achievementPercent) },
];
