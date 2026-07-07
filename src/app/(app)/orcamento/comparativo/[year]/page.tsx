import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import {
  getAnnualPlannedVsActual,
  computeMonthSavings,
  findBiggestOverrun,
  findBiggestSaving,
  compareCategoryBudget,
  type CategoryComparison,
} from "@/lib/planning/budget-comparison";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { PlannedVsActualBarChart } from "@/components/charts/PlannedVsActualBarChart";
import { PlannedVsActualLineChart } from "@/components/charts/PlannedVsActualLineChart";
import { formatPercentNumber } from "@/lib/format";
import type { MonthlyPlannedVsActual } from "@/lib/planning/budget-comparison";

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

const STATUS_LABEL: Record<CategoryComparison["status"], string> = {
  DENTRO: "Dentro do orçamento",
  ACIMA: "Acima do orçamento",
  SEM_PLANO: "Sem plano definido",
};

const STATUS_BADGE_TONE: Record<CategoryComparison["status"], "success" | "danger" | "neutral"> = {
  DENTRO: "success",
  ACIMA: "danger",
  SEM_PLANO: "neutral",
};

const STATUS_BAR_TONE: Record<CategoryComparison["status"], "success" | "danger" | "neutral"> = {
  DENTRO: "success",
  ACIMA: "danger",
  SEM_PLANO: "neutral",
};

export default async function OrcamentoComparativoPage(props: PageProps<"/orcamento/comparativo/[year]">) {
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  const ctx = await getRequiredSession();
  const comparison = await getAnnualPlannedVsActual(ctx, year);

  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const currentMonthData = isCurrentYear ? comparison.months.find((m) => m.month === now.getMonth() + 1) : undefined;

  const monthSavings = currentMonthData ? computeMonthSavings(currentMonthData) : null;
  const biggestOverrun = currentMonthData ? findBiggestOverrun(currentMonthData.categories) : null;
  const biggestSaving = currentMonthData ? findBiggestSaving(currentMonthData.categories) : null;

  // Comparação por categoria somando os meses já realizados no ano.
  const realizedMonths = comparison.months.filter((m) => m.isRealized);
  const categoryTotals = new Map<string, { planned: number; spent: number }>();
  for (const month of realizedMonths) {
    for (const cat of month.categories) {
      const existing = categoryTotals.get(cat.parentCategory) ?? { planned: 0, spent: 0 };
      existing.planned += cat.planned;
      existing.spent += cat.spent;
      categoryTotals.set(cat.parentCategory, existing);
    }
  }
  const categoryComparisons: CategoryComparison[] = PARENT_CATEGORIES.map((parentCategory) => {
    const totals = categoryTotals.get(parentCategory) ?? { planned: 0, spent: 0 };
    const { deviationPercent, status } = compareCategoryBudget(totals.planned, totals.spent);
    return { parentCategory, planned: totals.planned, spent: totals.spent, deviationPercent, status };
  });

  const monthColumns: ResponsiveColumn<MonthlyPlannedVsActual>[] = [
    { key: "month", label: "Mês", render: (m) => MONTH_LABELS[m.month - 1] },
    { key: "planned", label: "Planejado", render: (m) => formatBRL(m.totalPlanned) },
    { key: "spent", label: "Realizado", render: (m) => (m.isRealized ? formatBRL(m.totalSpent) : "—") },
    {
      key: "diff",
      label: "Diferença",
      render: (m) =>
        m.isRealized ? (
          <span className={m.totalPlanned - m.totalSpent >= 0 ? "text-success" : "text-danger"}>
            {formatBRL(m.totalPlanned - m.totalSpent)}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Planejado x Realizado"
        subtitle="Compare quanto você planejou gastar com quanto gastou de fato, mês a mês e por categoria."
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/orcamento/comparativo/${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/orcamento/comparativo/${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      {isCurrentYear && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Economia no mês"
            value={monthSavings === null ? "—" : formatBRL(Math.abs(monthSavings))}
            tone={monthSavings === null ? "neutral" : monthSavings >= 0 ? "success" : "danger"}
            hint={monthSavings === null ? "Defina um planejamento para ver essa comparação." : monthSavings >= 0 ? "Abaixo do planejado" : "Acima do planejado"}
          />
          <StatCard
            label="Categoria que mais estourou"
            value={biggestOverrun ? PARENT_CATEGORY_LABEL[biggestOverrun.parentCategory] : "Nenhuma"}
            tone={biggestOverrun ? "danger" : "neutral"}
            hint={
              biggestOverrun && biggestOverrun.deviationPercent !== null
                ? `+${formatPercentNumber(biggestOverrun.deviationPercent * 100, 0)} acima do planejado`
                : "Nenhuma categoria estourou este mês"
            }
          />
          <StatCard
            label="Melhor categoria"
            value={biggestSaving ? PARENT_CATEGORY_LABEL[biggestSaving.parentCategory] : "Nenhuma"}
            tone={biggestSaving ? "success" : "neutral"}
            hint={
              biggestSaving && biggestSaving.deviationPercent !== null
                ? `${formatPercentNumber(biggestSaving.deviationPercent * 100, 0)} vs. o planejado`
                : "Sem economia de destaque este mês"
            }
          />
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Planejado vs Realizado por mês</h2>
        <PlannedVsActualBarChart months={comparison.months} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Planejado vs Realizado ao longo do ano</h2>
        <PlannedVsActualLineChart months={comparison.months} />
      </Card>

      <div>
        <h2 className="mb-3 text-h2 font-semibold tracking-tight text-ink">Por categoria</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryComparisons.map((c) => {
            const percent = c.planned > 0 ? Math.min(c.spent / c.planned, 1) : 0;
            return (
              <Card key={c.parentCategory} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{PARENT_CATEGORY_LABEL[c.parentCategory]}</p>
                  <Badge tone={STATUS_BADGE_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <ProgressBar percent={percent} tone={STATUS_BAR_TONE[c.status]} />
                <p className="text-xs text-ink-muted">
                  {formatBRL(c.spent)} de {formatBRL(c.planned)} planejado
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      <CollapsibleSection label="Ver dados detalhados mês a mês">
        <ResponsiveTable columns={monthColumns} rows={comparison.months} rowKey={(m) => String(m.month)} />
      </CollapsibleSection>
    </div>
  );
}
