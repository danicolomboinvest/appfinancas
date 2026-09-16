import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPortfolioByObjective, getAllocationByClass } from "@/lib/consolidation/portfolio";
import { getPortfolioStrategyComparison } from "@/lib/portfolio/strategy";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import type { GoalAllocation } from "@/lib/consolidation/portfolio";
import { StrategyComparisonSection } from "./StrategyComparisonSection";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import type { MoneyFormatter } from "@/lib/money";
import { Section } from "@/components/ui/Section";


function formatPercent(value: number | null) {
  if (value === null) return "—";
  return formatPercentNumber(value * 100, 1);
}

export default async function CarteiraPorObjetivoPage() {
  const money = await serverMoney();
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

      <Section title="Posição por objetivo">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total da carteira" value={money(byObjective.totalPortfolio)} tone="accent" />
          <StatCard
            label="Reserva de emergência"
            value={money(byObjective.reserva.currentValue)}
            hint={
              byObjective.reserva.targetAmount !== null
                ? `${formatPercent(byObjective.reserva.achievementPercent)} da meta (${money(byObjective.reserva.targetAmount)})`
                : "Sem meta cadastrada em Reserva de Emergência"
            }
          />
          <StatCard label="Liberdade financeira" value={money(byObjective.liberdade.currentValue)} />
          <StatCard label="Sem objetivo definido" value={money(byObjective.outro.currentValue)} />
        </div>
      </Section>

      {byObjective.metas.length > 0 && (
        <Section title="Metas">
          <ResponsiveTable columns={goalColumns(money)} rows={byObjective.metas} rowKey={(goal) => goal.goalId} />
        </Section>
      )}

      <Section
        title="Carteira atual × estratégia-alvo"
        action={
          <Link href="/carteira/estrategia" className="text-caption font-medium text-accent-strong hover:underline">
            {hasStrategy ? "editar estratégia" : "definir estratégia"} →
          </Link>
        }
      >
        <StrategyComparisonSection positions={strategyComparison.positions} hasStrategy={hasStrategy} />
      </Section>

      <Section title="Alocação atual × ideal por classe">
        {allocation.classes.length === 0 ? (
          <p className="text-sm text-ink-faint">Nenhum ativo cadastrado ainda.</p>
        ) : (
          <AllocationChart classes={allocation.classes} />
        )}
      </Section>
    </div>
  );
}

const goalColumns = (money: MoneyFormatter): ResponsiveColumn<GoalAllocation>[] => [
  {
    key: "name",
    label: "Meta",
    render: (goal) => (
      <Link href={`/planejamento/metas/${goal.goalId}`} className="font-medium text-accent-strong hover:underline">
        {goal.goalName}
      </Link>
    ),
  },
  { key: "current", label: "Alocado", render: (goal) => money(goal.currentValue) },
  { key: "target", label: "Alvo", render: (goal) => money(goal.targetAmount) },
  { key: "achievement", label: "Atingimento", render: (goal) => formatPercent(goal.achievementPercent) },
];
