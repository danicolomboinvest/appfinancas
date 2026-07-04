import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const ctx = await getRequiredSession();
  const year = new Date().getFullYear();
  const summary = await getYearlySummary(ctx, year);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-black/60">
          Consolidado de {year}.{" "}
          <Link href={`/mensal/${year}`} className="underline">
            Ver controle mensal
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Renda no ano" value={formatBRL(summary.totalIncome)} />
        <SummaryCard label="Gastos no ano" value={formatBRL(summary.totalExpense)} />
        <SummaryCard label="Aportes no ano" value={formatBRL(summary.totalInvestment)} />
        <SummaryCard label="Saldo no ano" value={formatBRL(summary.balance)} />
        <SummaryCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : `${(summary.savingsRate * 100).toFixed(1)}%`}
        />
      </div>

      <YearlyBarChart months={summary.months} />
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
