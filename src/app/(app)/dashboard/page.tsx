import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const ctx = await getRequiredSession();
  const year = new Date().getFullYear();
  const [summary, portfolio] = await Promise.all([getYearlySummary(ctx, year), getPortfolioByObjective(ctx)]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Visão Geral"
        subtitle={
          <>
            Consolidado de {year}.{" "}
            <Link href={`/mensal/${year}`} className="text-gold-strong hover:underline">
              Ver Fluxo Financeiro
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Patrimônio total" value={formatBRL(portfolio.totalPortfolio)} tone="gold" />
        <StatCard label="Renda no ano" value={formatBRL(summary.totalIncome)} tone="success" />
        <StatCard label="Gastos no ano" value={formatBRL(summary.totalExpense)} tone="danger" />
        <StatCard label="Aportes no ano" value={formatBRL(summary.totalInvestment)} />
        <StatCard label="Saldo no ano" value={formatBRL(summary.balance)} />
        <StatCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : `${(summary.savingsRate * 100).toFixed(1)}%`}
        />
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Renda, gastos e aportes por mês</h2>
        <YearlyBarChart months={summary.months} />
      </Card>
    </div>
  );
}
