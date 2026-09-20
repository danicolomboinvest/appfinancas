import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import {
  getAnnualPlannedVsActual,
  computeMonthSavings,
  findBiggestOverrun,
  findUnrecorded,
  findBiggestSaving,
  compareCategoryBudget,
  type CategoryComparison,
} from "@/lib/planning/budget-comparison";
import { getAnnualBudgetPlan, getAnnualBudgetPlanForCustomCategories } from "@/lib/repositories/budget.repo";
import { getAnnualMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getBudgetHints } from "@/lib/planning/budget-hints";
import { getSavingsTargets } from "@/lib/planning/savings-targets";
import { BudgetWizard } from "../BudgetWizard";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { PlanVsActualRow } from "@/components/charts/PlanVsActualRow";
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
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";
import { resumoDoMes } from "@/lib/planning/month-budget-summary";
import { ResumoDoMesCard } from "@/components/budget/ResumoDoMesCard";
import { AtualizarMesButton } from "@/components/budget/AtualizarMesButton";
import { getLastExpenseDate } from "@/lib/repositories/monthly-entry.repo";

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
  const agora = new Date();
  // Uma consulta a mais na página já custou caro antes: vai junto das outras, não em fila.
  const [comparison, customCategories, plan, annualPlan, monthSummary, hints, savingsTargets] = await Promise.all([
    getAnnualPlannedVsActual(ctx, year),
    listCustomCategories(ctx),
    getAnnualBudgetPlan(ctx, year),
    getAnnualMonthlyPlan(ctx, year),
    year === agora.getFullYear() ? getMonthlySummary(ctx, year, agora.getMonth() + 1) : null,
    getBudgetHints(ctx, year),
    getSavingsTargets(ctx, agora),
  ]);
  // Qualquer mês serve para preencher o formulário: o valor é o mesmo nos 12, e é o primeiro
  // que existir que responde "o que eu já tinha planejado?".
  const monthPlan = annualPlan.get(1) ?? [...annualPlan.values()][0] ?? null;
  const hasPlan = Object.values(plan).some((v) => v > 0) || (monthPlan?.plannedIncome ?? 0) > 0;
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

  // O resumo que abre a página. Só do mês corrente: "quanto posso gastar por dia" não existe
  // pra um mês que já acabou, e é justamente essa conta que faz o cartão valer a tela.
  const ultimoGasto =
    currentMonthData && isCurrentYear ? await getLastExpenseDate(ctx, year, currentMonthData.month) : null;
  const resumoMes =
    currentMonthData && isCurrentYear
      ? resumoDoMes({
          planejado: currentMonthData.totalPlanned,
          gasto: currentMonthData.totalSpent,
          hoje: now,
          ano: year,
          mes: currentMonthData.month,
          ultimoGasto,
        })
      : null;
  const ultimoDiaDoMes = currentMonthData ? new Date(year, currentMonthData.month, 0).getDate() : 0;

  const monthSavings = currentMonthData ? computeMonthSavings(currentMonthData) : null;
  const biggestOverrun = currentMonthData ? findBiggestOverrun(currentMonthData.categories) : null;
  const biggestSaving = currentMonthData ? findBiggestSaving(currentMonthData.categories) : null;
  const unrecorded = currentMonthData ? findUnrecorded(currentMonthData.categories) : [];

  // Comparação por categoria no ANO DA PESSOA: o planejado soma do mês em que ela começou
  // até dezembro (o que ela se propôs a gastar de lá pra frente); o gasto, só os meses já
  // vividos. Quem começou em setembro vê "R$ 0 de R$ 6.000" com o tracinho em 1/4, não
  // "R$ 0 de R$ 13.500" com janeiro a agosto em dívida.
  const realizedMonths = comparison.months.filter((m) => m.isRealized);
  const windowMonths = comparison.months.filter((m) => m.month >= comparison.startMonth);
  const categoryTotals = new Map<string, { planned: number; spent: number }>();
  for (const month of windowMonths) {
    for (const cat of month.categories) {
      const existing = categoryTotals.get(cat.categoryKey) ?? { planned: 0, spent: 0 };
      existing.planned += cat.planned;
      if (month.isRealized) existing.spent += cat.spent;
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
  const yearPace = realizedMonths.length > 0 && windowMonths.length > 0 ? realizedMonths.length / windowMonths.length : null;
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
      {/* Subtítulo curto de propósito: o cartão logo abaixo diz a mesma coisa com os números
          DELA, e no celular cada linha aqui empurra pra fora da tela o número que ela veio ver. */}
      <PageHeader
        title="Orçamento"
        subtitle="Quanto você planejou gastar, e quanto já foi."
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

      {/* Primeira coisa da página, de propósito: é o número que a pessoa veio ver. Tudo o que
          vem depois (categorias, ano, tabela) explica ESTE número. */}
      {resumoMes && (
        <ResumoDoMesCard
          resumo={resumoMes}
          mesLabel={MONTH_LABELS[currentMonthData!.month - 1]}
          ultimoDia={ultimoDiaDoMes}
          money={money}
          onAtualizar={<AtualizarMesButton />}
        />
      )}

      <CollapsibleSection
        label={hasPlan ? `Editar seu plano de ${year}: renda, aporte e gastos` : `Vamos montar seu orçamento de ${year}`}
        defaultOpen={!hasPlan}
      >
        <BudgetWizard
          year={year}
          hasPlan={hasPlan}
          hints={hints}
          savingsTargets={savingsTargets}
          plan={{
            plannedIncome: monthPlan?.plannedIncome ?? 0,
            plannedInvestment: monthPlan?.plannedInvestment ?? 0,
          }}
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

      {/* Três linhas no celular, três colunas no computador — e "sem lançamento" no lugar de
          "melhor categoria" quando o que existe é categoria em zero, não economia. */}
      {isCurrentYear && hasPlan && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          <StatCard
            layout="row"
            label="Economia no mês"
            value={monthSavings === null ? "—" : money(Math.abs(monthSavings))}
            tone={monthSavings === null ? "neutral" : monthSavings >= 0 ? "success" : "danger"}
            hint={monthSavings === null ? "Defina um planejamento para ver essa comparação." : monthSavings >= 0 ? "Abaixo do planejado" : "Acima do planejado"}
          />
          <StatCard
            layout="row"
            label="Categoria que mais estourou"
            value={biggestOverrun ? categoryLabel(biggestOverrun.categoryKey) : "Nenhuma"}
            tone={biggestOverrun ? "danger" : "neutral"}
            hint={
              biggestOverrun && biggestOverrun.deviationPercent !== null
                ? `+${formatPercentNumber(biggestOverrun.deviationPercent * 100, 0)} acima do planejado`
                : "Nenhuma categoria estourou este mês"
            }
          />
          {biggestSaving ? (
            <StatCard
              layout="row"
              label="Economizou mais em"
              value={categoryLabel(biggestSaving.categoryKey)}
              tone="success"
              hint={
                biggestSaving.deviationPercent !== null
                  ? `${formatPercentNumber(Math.abs(biggestSaving.deviationPercent) * 100, 0)} abaixo do planejado`
                  : undefined
              }
            />
          ) : (
            <StatCard
              layout="row"
              label={unrecorded.length === 1 ? "Sem lançamento" : `Sem lançamento (${unrecorded.length})`}
              value={unrecorded.length > 0 ? categoryLabel(unrecorded[0].categoryKey) : "Nenhuma"}
              tone="neutral"
              hint={
                unrecorded.length > 0
                  ? `${money(0, { round: true })} de ${money(unrecorded[0].planned, { round: true })} planejados — vale conferir`
                  : "Sem economia de destaque este mês"
              }
            />
          )}
        </div>
      )}

      {currentMonthData && monthSummary && (
        <Section
          title={`Renda e aporte em ${MONTH_LABELS[currentMonthData.month - 1]}`}
          hint="Planejar é decidir quanto entra, quanto sai e quanto fica guardado — não só o que gastar."
        >
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-8">
          <PlanVsActualRow
            label="Renda"
            planned={monthPlan?.plannedIncome ?? 0}
            actual={monthSummary.totalIncome}
            formatted={{
              planned: money(monthPlan?.plannedIncome ?? 0, { round: true }),
              actual: money(monthSummary.totalIncome, { round: true }),
            }}
            color="var(--color-success)"
          />
          <PlanVsActualRow
            label="Aporte"
            planned={monthPlan?.plannedInvestment ?? 0}
            actual={monthSummary.totalInvestment}
            formatted={{
              planned: money(monthPlan?.plannedInvestment ?? 0, { round: true }),
              actual: money(monthSummary.totalInvestment, { round: true }),
            }}
            color="var(--color-accent)"
          />
          </div>
        </Section>
      )}

      <Section
        title="Planejado × realizado no ano"
        hint="O preenchimento é o que você já gastou no ano. O tracinho é onde o ano está."
      >
        <BulletBar
          rows={yearBullets}
          targetHint="Passou do tracinho? Está gastando adiantado para a altura do ano."
          wide
        />
      </Section>

      {monthBullets.length > 0 && (
        <Section
          title={`Por categoria em ${MONTH_LABELS[(currentMonthData?.month ?? 1) - 1]}`}
          hint="Ordenado por quem está mais perto de estourar — quem precisa de atenção fica no topo."
        >
          <BulletBar rows={monthBullets} wide />
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
