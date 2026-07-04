import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function YearPage(props: PageProps<"/mensal/[year]">) {
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  const ctx = await getRequiredSession();
  const summary = await getYearlySummary(ctx, year);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Fluxo Financeiro — ${year}`}
        subtitle="Consolidação automática dos 12 meses do ano."
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/mensal/${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/mensal/${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Renda" value={formatBRL(summary.totalIncome)} tone="success" />
        <StatCard label="Gastos" value={formatBRL(summary.totalExpense)} tone="danger" />
        <StatCard label="Aportes" value={formatBRL(summary.totalInvestment)} />
        <StatCard label="Saldo" value={formatBRL(summary.balance)} tone="gold" />
        <StatCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : `${(summary.savingsRate * 100).toFixed(1)}%`}
        />
      </div>

      <Card className="p-5">
        <YearlyBarChart months={summary.months} />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Mês</th>
              <th className="px-4 py-3 font-medium">Renda</th>
              <th className="px-4 py-3 font-medium">Gastos</th>
              <th className="px-4 py-3 font-medium">Aportes</th>
              <th className="px-4 py-3 font-medium">Saldo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {summary.months.map((m) => (
              <tr key={m.month} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-3 text-ink">{MONTH_LABELS[m.month - 1]}</td>
                <td className="px-4 py-3 text-ink-muted">{formatBRL(m.totalIncome)}</td>
                <td className="px-4 py-3 text-ink-muted">{formatBRL(m.totalExpense)}</td>
                <td className="px-4 py-3 text-ink-muted">{formatBRL(m.totalInvestment)}</td>
                <td className="px-4 py-3 text-ink-muted">{formatBRL(m.balance)}</td>
                <td className="px-4 py-3">
                  <Link href={`/mensal/${year}/${m.month}`} className="font-medium text-gold-strong hover:underline">
                    Lançar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
