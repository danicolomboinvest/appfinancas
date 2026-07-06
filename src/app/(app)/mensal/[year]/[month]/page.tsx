import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EntryForm } from "./EntryForm";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { BudgetSection } from "../BudgetSection";

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

const CATEGORY_LABEL: Record<string, string> = {
  INCOME: "Renda",
  EXPENSE: "Gasto",
  INVESTMENT_CONTRIBUTION: "Aporte",
};

const CATEGORY_TONE: Record<string, "success" | "danger" | "accent"> = {
  INCOME: "success",
  EXPENSE: "danger",
  INVESTMENT_CONTRIBUTION: "accent",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default async function MonthPage(props: PageProps<"/mensal/[year]/[month]">) {
  const { year: yearParam, month: monthParam } = await props.params;
  const year = Number(yearParam);
  const month = Number(monthParam);

  const ctx = await getRequiredSession();
  const [entries, summary, recentSubcategories] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    listRecentSubcategories(ctx),
  ]);

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Seu dinheiro no mês", href: "/mensal" },
          { label: String(year), href: `/mensal/${year}` },
          { label: MONTH_LABELS[month - 1] },
        ]}
      />

      <PageHeader
        title={`${MONTH_LABELS[month - 1]} de ${year}`}
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/mensal/${prev.year}/${prev.month}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {MONTH_LABELS[prev.month - 1]}
            </Link>
            <Link
              href={`/mensal/${next.year}/${next.month}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {MONTH_LABELS[next.month - 1]} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Renda" value={formatBRL(summary.totalIncome)} tone="success" />
        <StatCard label="Gastos" value={formatBRL(summary.totalExpense)} tone="danger" />
        <StatCard label="Aportes" value={formatBRL(summary.totalInvestment)} />
        <StatCard label="Saldo" value={formatBRL(summary.balance)} tone="accent" />
      </div>

      <EntryForm year={year} month={month} recentSubcategories={recentSubcategories} />

      <BudgetSection ctx={ctx} year={year} month={month} totalIncome={summary.totalIncome} />

      {entries.length === 0 ? (
        <EmptyState message="Nenhum lançamento neste mês ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Badge tone={CATEGORY_TONE[entry.category]}>{CATEGORY_LABEL[entry.category]}</Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{entry.subcategory ?? "Sem subcategoria"}</p>
                  {entry.description && <p className="truncate text-xs text-ink-faint">{entry.description}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm font-medium text-ink">{formatBRL(Number(entry.amount))}</p>
                <DeleteEntryButton id={entry.id} year={year} month={month} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
