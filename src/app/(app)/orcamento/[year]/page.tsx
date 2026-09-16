import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getAnnualBudgetPlan, getAnnualBudgetPlanForCustomCategories } from "@/lib/repositories/budget.repo";
import {
  PARENT_CATEGORIES,
  PARENT_CATEGORY_LABEL,
  PARENT_CATEGORY_DESCRIPTION,
  isParentCategoryKey,
  colorForCategorySlice,
} from "@/lib/categories";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { BulletBar } from "@/components/charts/BulletBar";
import { buildBudgetBullets, elapsedRatioOfMonth } from "@/lib/planning/budget-bullets";
import { formatPercentNumber } from "@/lib/format";
import type { MonthlyPlannedVsActual } from "@/lib/planning/budget-comparison";
import { OrcamentoForm } from "../OrcamentoForm";
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";

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


export default async function OrcamentoPage(props: PageProps<"/orcamento/[year]">) {
  const money = await serverMoney();
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  // URL editada à mão ("/orcamento/abc") viraria NaN direto no Prisma → erro 500. Fora da
  // faixa válida é simplesmente uma página que não existe (mesmo guard do fluxo mensal).
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    notFound();
  }
  const ctx = await getRequiredSession();
  const [comparison, customCategories, plan] = await Promise.all([
    getAnnualPlannedVsActual(ctx, year),
    listCustomCategories(ctx),
    getAnnualBudgetPlan(ctx, year),
  ]);
  const customPlan = await getAnnualBudgetPlanForCustomCategories(
    ctx,
    year,
    customCategories.map((c) => c.id),
  );
  const customCategoryLabels = new Map(customCategories.map((c) => [c.id, c.name]));
  function categoryLabel(categoryKey: string): string {
    return isParentCategoryKey(categoryKey)
      ? PARENT_CATEGORY_LABEL[categoryKey]
      : (customCategoryLabels.get(categoryKey) ?? "Categoria personalizada");
  }
  const allCategoryKeys: string[] = [...PARENT_CATEGORIES, ...customCategories.map((c) => c.id)];
  function categoryColor(categoryKey: string): string {
    return colorForCategorySlice(
      isParentCategoryKey(categoryKey)
        ? { kind: "parent", value: categoryKey }
        : { kind: "custom", value: categoryKey },
    );
  }

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
      const existing = categoryTotals.get(cat.categoryKey) ?? { planned: 0, spent: 0 };
      existing.planned += cat.planned;
      existing.spent += cat.spent;
      categoryTotals.set(cat.categoryKey, existing);
    }
  }
  const categoryComparisons: CategoryComparison[] = allCategoryKeys.map((categoryKey) => {
    const totals = categoryTotals.get(categoryKey) ?? { planned: 0, spent: 0 };
    const { deviationPercent, status } = compareCategoryBudget(totals.planned, totals.spent);
    return { categoryKey, planned: totals.planned, spent: totals.spent, deviationPercent, status };
  });

  // Tracinho do ano: a fração do ano que já passou (meses realizados / 12). Gastar 80% do
  // orçamento anual em março é a mesma informação que gastar 80% do mensal no dia 5.
  const yearPace = realizedMonths.length > 0 ? realizedMonths.length / 12 : null;
  const yearBullets = buildBudgetBullets(categoryComparisons, {
    paceRatio: isCurrentYear ? yearPace : 1,
    money,
    labelFor: categoryLabel,
    colorFor: categoryColor,
    labelStyle: "de",
  });

  const monthOverCounts = { over: 0, within: 0, unplanned: 0 };
  const monthBullets = currentMonthData
    ? buildBudgetBullets(currentMonthData.categories, {
        paceRatio: elapsedRatioOfMonth(now, year, currentMonthData.month),
        money,
        labelFor: categoryLabel,
        colorFor: categoryColor,
        labelStyle: "restante",
      })
    : [];
  for (const row of monthBullets) {
    if (row.isUnplanned) monthOverCounts.unplanned += 1;
    else if (row.isOver) monthOverCounts.over += 1;
    else monthOverCounts.within += 1;
  }
  const { over: monthOver, within: monthWithin, unplanned: monthUnplanned } = monthOverCounts;

  const monthColumns: ResponsiveColumn<MonthlyPlannedVsActual>[] = [
    { key: "month", label: "Mês", render: (m) => MONTH_LABELS[m.month - 1] },
    { key: "planned", label: "Planejado", render: (m) => money(m.totalPlanned) },
    { key: "spent", label: "Realizado", render: (m) => (m.isRealized ? money(m.totalSpent) : "—") },
    {
      key: "diff",
      label: "Diferença",
      render: (m) =>
        m.isRealized ? (
          <span className={m.totalPlanned - m.totalSpent >= 0 ? "text-success" : "text-danger"}>
            {money(m.totalPlanned - m.totalSpent)}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Orçamento"
        subtitle="Compare quanto você planejou gastar com quanto gastou de fato, mês a mês e por categoria."
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/orcamento/${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/orcamento/${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <CollapsibleSection label={`Editar quanto você planeja gastar em ${year}`}>
        <p className="mb-4 text-sm text-ink-muted">
          Defina uma média mensal por categoria. Para despesas que acontecem só uma vez por ano (IPVA, seguro,
          manutenção do carro, presentes), divida o valor anual por 12.
        </p>
        <OrcamentoForm
          year={year}
          parentCategories={PARENT_CATEGORIES.map((parentCategory) => ({
            key: parentCategory,
            label: PARENT_CATEGORY_LABEL[parentCategory],
            description: PARENT_CATEGORY_DESCRIPTION[parentCategory],
            defaultValue: plan[parentCategory],
          }))}
          customCategories={customCategories.map((category) => ({
            id: category.id,
            name: category.name,
            icon: category.icon,
            defaultValue: customPlan[category.id] ?? 0,
          }))}
        />
      </CollapsibleSection>

      {isCurrentYear && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard
            label="Economia no mês"
            value={monthSavings === null ? "—" : money(Math.abs(monthSavings))}
            tone={monthSavings === null ? "neutral" : monthSavings >= 0 ? "success" : "danger"}
            hint={monthSavings === null ? "Defina um planejamento para ver essa comparação." : monthSavings >= 0 ? "Abaixo do planejado" : "Acima do planejado"}
          />
          <StatCard
            label="Categoria que mais estourou"
            value={biggestOverrun ? categoryLabel(biggestOverrun.categoryKey) : "Nenhuma"}
            tone={biggestOverrun ? "danger" : "neutral"}
            hint={
              biggestOverrun && biggestOverrun.deviationPercent !== null
                ? `+${formatPercentNumber(biggestOverrun.deviationPercent * 100, 0)} acima do planejado`
                : "Nenhuma categoria estourou este mês"
            }
          />
          <StatCard
            label="Melhor categoria"
            value={biggestSaving ? categoryLabel(biggestSaving.categoryKey) : "Nenhuma"}
            tone={biggestSaving ? "success" : "neutral"}
            hint={
              biggestSaving && biggestSaving.deviationPercent !== null
                ? `${formatPercentNumber(biggestSaving.deviationPercent * 100, 0)} vs. o planejado`
                : "Sem economia de destaque este mês"
            }
          />
        </div>
      )}

      <Section
        title="Planejado × realizado no ano"
        hint="O preenchimento é o que você já gastou no ano. O tracinho é onde o ano está."
      >
        <BulletBar rows={yearBullets} targetHint="Passou do tracinho? Está gastando adiantado para a altura do ano." />
      </Section>

      {monthBullets.length > 0 && (
        <Section
          title={`Por categoria em ${MONTH_LABELS[(currentMonthData?.month ?? 1) - 1]}`}
          hint="Ordenado por quem está mais perto de estourar — quem precisa de atenção fica no topo."
        >
          <BulletBar rows={monthBullets} />
          {/* O veredito em uma linha: o desenho aprovado fecha a lista com a conta feita, pra
              a pessoa não precisar somar quantas barras estão vermelhas. */}
          <div className="flex flex-wrap items-center gap-2">
            {monthOver > 0 && (
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-caption font-medium text-danger">
                {monthOver} categoria{monthOver === 1 ? "" : "s"} estourou{monthOver === 1 ? "" : "ram"}
              </span>
            )}
            {monthWithin > 0 && (
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
                {monthWithin} dentro do plano
              </span>
            )}
            {monthUnplanned > 0 && (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink-muted">
                {monthUnplanned} sem plano
              </span>
            )}
          </div>
          <p className="text-caption text-ink-faint">
            Categoria sem plano definido fica cinza: o app não tem como dizer que você estourou um limite que
            não existe.
          </p>
        </Section>
      )}

      <CollapsibleSection label="Ver dados detalhados mês a mês">
        <ResponsiveTable columns={monthColumns} rows={comparison.months} rowKey={(m) => String(m.month)} />
      </CollapsibleSection>
    </div>
  );
}
