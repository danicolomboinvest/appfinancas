import { notFound } from "next/navigation";
import { Receipt, TrendingUp, PiggyBank, type LucideIcon } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import {
  sumExpensesByParentCategory,
  sumExpensesByCustomCategory,
  listBudgets,
  listBudgetsForYear,
} from "@/lib/repositories/budget.repo";
import { getMonthlySummary, getAnnualSummary } from "@/lib/consolidation/monthly";
import {
  PARENT_CATEGORY_LABEL,
  PARENT_CATEGORY_ICON,
  PARENT_CATEGORY_COLOR,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  isParentCategoryKey,
} from "@/lib/categories";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DonutAllocationChart, type DonutSlice } from "@/components/charts/DonutAllocationChart";
import { EntryForm } from "./EntryForm";
import { EntryRowActions } from "./EntryRowActions";
import { WeeklyRecapCard } from "./WeeklyRecapCard";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { prisma } from "@/lib/db/prisma";
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

/** Cor do valor por tipo de lançamento — mesma convenção do resto do app (verde entrada,
 * vermelho saída, dourado aporte). */
const CATEGORY_AMOUNT_CLASS: Record<string, string> = {
  INCOME: "text-success",
  EXPENSE: "text-danger",
  INVESTMENT_CONTRIBUTION: "text-accent-strong",
};

/** Ícone + cor do círculo de categoria (assinatura visual do documento de referência) — por
 * categoria-mãe pra gastos; ícone fixo colorido pelo tom pra renda/aporte, que não têm categoria. */
function categoryVisual(
  entry: { category: string; parentCategory: string | null; customCategoryId: string | null },
  customCategories: { id: string; icon: string }[],
): { icon: LucideIcon; color: string } {
  if (entry.category === "INCOME") return { icon: TrendingUp, color: "var(--color-success)" };
  if (entry.category === "INVESTMENT_CONTRIBUTION") return { icon: PiggyBank, color: "var(--color-accent)" };
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) {
    return { icon: PARENT_CATEGORY_ICON[entry.parentCategory], color: PARENT_CATEGORY_COLOR[entry.parentCategory] };
  }
  if (entry.customCategoryId) {
    const custom = customCategories.find((c) => c.id === entry.customCategoryId);
    return {
      icon: custom ? (CUSTOM_CATEGORY_ICON_MAP[custom.icon] ?? Receipt) : Receipt,
      color: colorForCategorySlice({ kind: "custom", value: entry.customCategoryId }),
    };
  }
  return { icon: Receipt, color: "var(--color-ink-faint)" };
}

/** "Hoje" / "Ontem" / "15 de jul" — datas relativas nas listas, como pede o documento de
 * referência de design (em vez de sempre DD/MM). Comparado à data de hoje no fuso do Brasil. */
function formatRelativeDay(date: Date | null): string | null {
  if (!date) return null;
  const iso = date.toISOString().slice(0, 10);
  const today = nowInBrazil();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (iso === todayIso) return "Hoje";
  if (iso === yesterdayIso) return "Ontem";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Meses movimentados podem ter dezenas de lançamentos — mostra os mais recentes direto e
 * esconde o resto atrás de "Ver mais" em vez de empilhar tudo de uma vez no mobile. */
const VISIBLE_ENTRIES_COUNT = 8;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Date do banco → "YYYY-MM-DD" (o campo é @db.Date, sem hora relevante). */
function toDateInput(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function EntryRow({
  entry,
  year,
  month,
  recentSubcategories,
  customCategories,
  goals,
}: {
  entry: Awaited<ReturnType<typeof listMonthlyEntries>>[number];
  year: number;
  month: number;
  recentSubcategories: Awaited<ReturnType<typeof listRecentSubcategories>>;
  customCategories: { id: string; name: string; icon: string }[];
  goals: { id: string; name: string }[];
}) {
  const dayLabel = formatRelativeDay(entry.entryDate);
  const visual = categoryVisual(entry, customCategories);
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon icon={visual.icon} color={visual.color} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{entry.subcategory ?? "Sem subcategoria"}</p>
          <p className="truncate text-xs text-ink-faint">
            {dayLabel && <span className="tabular-nums">{dayLabel}</span>}
            {dayLabel && entry.description && " · "}
            {entry.description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className={`text-sm font-medium tabular-nums ${CATEGORY_AMOUNT_CLASS[entry.category]}`}>
          {formatBRL(Number(entry.amount))}
        </p>
        <EntryRowActions
          entry={{
            id: entry.id,
            year,
            month,
            category: entry.category,
            parentCategory: entry.parentCategory,
            customCategoryId: entry.customCategoryId,
            subcategory: entry.subcategory,
            description: entry.description,
            amount: Number(entry.amount),
            entryDate: toDateInput(entry.entryDate),
            goalId: entry.goalId,
          }}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals}
        />
      </div>
    </Card>
  );
}

export default async function MonthPage(props: PageProps<"/mensal/[year]/[month]">) {
  const { year: yearParam, month: monthParam } = await props.params;
  const { view } = await props.searchParams;
  const year = Number(yearParam);
  const month = Number(monthParam);
  // URL editada à mão ("/mensal/abc/13") viraria NaN/mês 13 direto no Prisma → erro 500.
  // Fora da faixa válida é simplesmente uma página que não existe.
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    notFound();
  }
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
    goals,
    spentByParent,
    spentByCustom,
    onboardingCounts,
  ] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getAnnualSummary(ctx, year),
    listBudgets(ctx, year, month),
    listBudgetsForYear(ctx, year),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    // Primeiros passos do onboarding: 1 registro de cada tipo basta pra saber o que falta.
    Promise.all([
      prisma.monthlyEntry.count({ where: { userId: ctx.userId }, take: 1 }),
      prisma.budget.count({ where: { userId: ctx.userId }, take: 1 }),
      prisma.asset.count({ where: { userId: ctx.userId }, take: 1 }),
    ]),
  ]);
  const [entryCount, budgetCount, assetCount] = onboardingCounts;

  // Planejamento = soma dos valores planejados (orçamento). Mensal: só o mês; anual: o ano todo.
  const monthlyPlanned = monthBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);
  const annualPlanned = yearBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);

  const goalOptions = goals.map((g) => ({ id: g.id, name: g.name }));

  // Ritmo do mês: % do orçamento consumido vs. % do mês decorrido — mais honesto que "limite
  // diário" (média), porque gasto não é linear. Só faz sentido no mês corrente e com orçamento.
  // Fuso do Brasil: com o relógio UTC do servidor, das 21h à meia-noite o app acharia que já é
  // o dia (ou mês) seguinte.
  const now = nowInBrazil();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const pacing =
    isCurrentMonth && monthlyPlanned > 0
      ? { budgetUsed: summary.totalExpense / monthlyPlanned, monthElapsed: now.getDate() / daysInMonth }
      : null;

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
      .map((s) => ({
        name: PARENT_CATEGORY_LABEL[s.parentCategory],
        value: s.spent / totalSpentByCategory,
        color: colorForCategorySlice({ kind: "parent", value: s.parentCategory }),
      })),
    ...spentByCustom
      .filter((s) => s.spent > 0)
      .map((s) => ({
        name: customCategoryNameById.get(s.customCategoryId) ?? "Outro",
        value: s.spent / totalSpentByCategory,
        color: colorForCategorySlice({ kind: "custom", value: s.customCategoryId }),
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

      <OnboardingChecklist hasEntry={entryCount > 0} hasBudget={budgetCount > 0} hasAsset={assetCount > 0} />

      {isCurrentMonth && <WeeklyRecapCard />}

      <FlowIndicators
        year={year}
        month={month}
        initialView={initialView}
        monthly={monthlyBundle}
        annual={annualBundle}
        pacing={pacing}
      />

      <EntryForm
        year={year}
        month={month}
        recentSubcategories={recentSubcategories}
        customCategories={customCategories}
        goals={goalOptions}
        // Lançando num mês que não é o atual, a data default acompanha o mês visualizado
        // (dia 1) — "hoje" criaria um lançamento com data de julho dentro de junho.
        defaultEntryDate={isCurrentMonth ? undefined : `${year}-${String(month).padStart(2, "0")}-01`}
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
            <EntryRow
              key={entry.id}
              entry={entry}
              year={year}
              month={month}
              recentSubcategories={recentSubcategories}
              customCategories={customCategories}
              goals={goalOptions}
            />
          ))}
          {entries.length > VISIBLE_ENTRIES_COUNT && (
            <CollapsibleSection label={`Ver mais ${entries.length - VISIBLE_ENTRIES_COUNT} lançamentos`}>
              <div className="flex flex-col gap-2">
                {entries.slice(VISIBLE_ENTRIES_COUNT).map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    year={year}
                    month={month}
                    recentSubcategories={recentSubcategories}
                    customCategories={customCategories}
                    goals={goalOptions}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
