import { Receipt } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import {
  sumExpensesByParentCategory,
  sumExpensesByCustomCategory,
  listBudgets,
  listBudgetsForYear,
} from "@/lib/repositories/budget.repo";
import { getMonthlySummary, getAnnualSummary } from "@/lib/consolidation/monthly";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DonutAllocationChart, type DonutSlice } from "@/components/charts/DonutAllocationChart";
import { EntryForm } from "./EntryForm";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { FlowIndicators, type FlowBundle } from "./FlowIndicators";
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

/** Meses movimentados podem ter dezenas de lançamentos — mostra os mais recentes direto e
 * esconde o resto atrás de "Ver mais" em vez de empilhar tudo de uma vez no mobile. */
const VISIBLE_ENTRIES_COUNT = 8;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EntryRow({
  entry,
  year,
  month,
}: {
  entry: Awaited<ReturnType<typeof listMonthlyEntries>>[number];
  year: number;
  month: number;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
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
  );
}

export default async function MonthPage(props: PageProps<"/mensal/[year]/[month]">) {
  const { year: yearParam, month: monthParam } = await props.params;
  const { view } = await props.searchParams;
  const year = Number(yearParam);
  const month = Number(monthParam);
  const initialView = view === "anual" ? "anual" : "mensal";

  const ctx = await getRequiredSession();
  const [
    entries,
    summary,
    annualSummary,
    monthBudgets,
    yearBudgets,
    recentSubcategories,
    customCategories,
    spentByParent,
    spentByCustom,
  ] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getAnnualSummary(ctx, year),
    listBudgets(ctx, year, month),
    listBudgetsForYear(ctx, year),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
  ]);

  // Planejamento = soma dos valores planejados (orçamento). Mensal: só o mês; anual: o ano todo.
  const monthlyPlanned = monthBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);
  const annualPlanned = yearBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);

  const monthlyBundle: FlowBundle = {
    income: summary.totalIncome,
    expense: summary.totalExpense,
    planned: monthlyPlanned,
    investment: summary.totalInvestment,
    balance: summary.balance,
  };
  const annualBundle: FlowBundle = {
    income: annualSummary.totalIncome,
    expense: annualSummary.totalExpense,
    planned: annualPlanned,
    investment: annualSummary.totalInvestment,
    balance: annualSummary.balance,
  };

  const customCategoryNameById = new Map(customCategories.map((c) => [c.id, c.name]));
  const totalSpentByCategory =
    spentByParent.reduce((sum, s) => sum + s.spent, 0) + spentByCustom.reduce((sum, s) => sum + s.spent, 0);
  const spendingSlices: DonutSlice[] = [
    ...spentByParent
      .filter((s) => s.spent > 0)
      .map((s) => ({ name: PARENT_CATEGORY_LABEL[s.parentCategory], value: s.spent / totalSpentByCategory })),
    ...spentByCustom
      .filter((s) => s.spent > 0)
      .map((s) => ({
        name: customCategoryNameById.get(s.customCategoryId) ?? "Outro",
        value: s.spent / totalSpentByCategory,
      })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Fluxo Financeiro", href: "/mensal" },
          { label: String(year), href: `/mensal/${year}` },
          { label: MONTH_LABELS[month - 1] },
        ]}
      />

      <FlowIndicators
        year={year}
        month={month}
        initialView={initialView}
        monthly={monthlyBundle}
        annual={annualBundle}
      />

      <EntryForm
        year={year}
        month={month}
        recentSubcategories={recentSubcategories}
        customCategories={customCategories}
      />

      <BudgetSection ctx={ctx} year={year} month={month} totalIncome={summary.totalIncome} />

      {totalSpentByCategory > 0 && (
        <Card className="p-5">
          <DonutAllocationChart title="Para onde foi seu dinheiro este mês" data={spendingSlices} />
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} message="Nenhum lançamento neste mês ainda. Use o formulário acima para registrar o primeiro." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.slice(0, VISIBLE_ENTRIES_COUNT).map((entry) => (
            <EntryRow key={entry.id} entry={entry} year={year} month={month} />
          ))}
          {entries.length > VISIBLE_ENTRIES_COUNT && (
            <CollapsibleSection label={`Ver mais ${entries.length - VISIBLE_ENTRIES_COUNT} lançamentos`}>
              <div className="flex flex-col gap-2">
                {entries.slice(VISIBLE_ENTRIES_COUNT).map((entry) => (
                  <EntryRow key={entry.id} entry={entry} year={year} month={month} />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
