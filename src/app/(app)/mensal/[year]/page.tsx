import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { QuickEntryButton } from "./QuickEntryButton";
import { formatPercentNumber } from "@/lib/format";

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

/** Tempo verbal do título depende de o ano já ter passado, estar em curso, ou ainda vir. */
function yearPageTitle(year: number): string {
  const currentYear = new Date().getFullYear();
  if (year < currentYear) return `Como estava seu dinheiro em ${year}?`;
  if (year > currentYear) return `Como vai estar seu dinheiro em ${year}?`;
  return `Como está seu dinheiro em ${year}?`;
}

export default async function YearPage(props: PageProps<"/mensal/[year]">) {
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  const ctx = await getRequiredSession();
  const [summary, recentSubcategories] = await Promise.all([
    getYearlySummary(ctx, year),
    listRecentSubcategories(ctx),
  ]);

  const monthsSoFar = summary.months.filter((m) => m.isRealized);
  const incomeSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1].slice(0, 3), value: m.totalIncome }));
  const expenseSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1].slice(0, 3), value: m.totalExpense }));
  const investmentSparkline = monthsSoFar.map((m) => ({
    label: MONTH_LABELS[m.month - 1].slice(0, 3),
    value: m.totalInvestment,
  }));
  const balanceSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1].slice(0, 3), value: m.balance }));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Seu dinheiro no mês", href: "/mensal" }, { label: String(year) }]} />

      <PageHeader
        title={yearPageTitle(year)}
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
        <StatCard label="Renda" value={formatBRL(summary.totalIncome)} tone="success" sparkline={incomeSparkline} />
        <StatCard label="Gastos" value={formatBRL(summary.totalExpense)} tone="danger" sparkline={expenseSparkline} />
        <StatCard label="Aportes" value={formatBRL(summary.totalInvestment)} sparkline={investmentSparkline} />
        <StatCard label="Saldo" value={formatBRL(summary.balance)} tone="accent" sparkline={balanceSparkline} />
        <StatCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : formatPercentNumber(summary.savingsRate * 100, 1)}
        />
      </div>

      <Card className="p-5">
        <YearlyBarChart months={summary.months} />
      </Card>

      <ResponsiveTable
        columns={monthColumns(year, recentSubcategories)}
        rows={summary.months}
        rowKey={(m) => String(m.month)}
      />
    </div>
  );
}

function monthColumns(
  year: number,
  recentSubcategories: Record<ParentCategory, string[]>,
): ResponsiveColumn<MonthlyBreakdown>[] {
  return [
    { key: "month", label: "Mês", render: (m) => MONTH_LABELS[m.month - 1] },
    { key: "income", label: "Renda", render: (m) => formatBRL(m.totalIncome) },
    { key: "expense", label: "Gastos", render: (m) => formatBRL(m.totalExpense) },
    { key: "investment", label: "Aportes", render: (m) => formatBRL(m.totalInvestment) },
    { key: "balance", label: "Saldo", render: (m) => formatBRL(m.balance) },
    {
      key: "actions",
      label: "",
      hideLabelOnMobile: true,
      render: (m) => <QuickEntryButton year={year} month={m.month} recentSubcategories={recentSubcategories} />,
    },
  ];
}
