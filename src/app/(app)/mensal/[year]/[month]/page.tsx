import Link from "next/link";
import { PaidDividendsCard } from "./PaidDividendsCard";
import { listRecentlyPaidDividends } from "@/lib/repositories/dividend.repo";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
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
import { getDailyFlow, getCategorySpending } from "@/lib/consolidation/month-analysis";
import { buildMonthInsights } from "@/lib/insights/month-insights";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getRecapDismissedMonth } from "@/lib/repositories/user.repo";
import { getRecapEligibility } from "@/lib/recap/monthly";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PARENT_CATEGORIES, categoryLabel, colorForCategorySlice } from "@/lib/categories";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { dadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { DreEmpresa } from "./DreEmpresa";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { Section } from "@/components/ui/Section";
import { MonthHeatmap } from "@/components/charts/MonthHeatmap";
import { EntryList } from "./EntryList";
import { ImportHistory } from "./ImportHistory";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { MonthlyRecapCard } from "./MonthlyRecapCard";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { prisma } from "@/lib/db/prisma";
import { FlowIndicators, type FlowBundle } from "./FlowIndicators";
import { BudgetSection } from "../BudgetSection";
import { MonthHighlight } from "./MonthHighlight";
import { MonthFlowCard } from "./MonthFlowCard";
import { getContributionLinkState } from "@/lib/portfolio/contribution-link";
import { TopCategories } from "./TopCategories";
import { IncomeSplitCard } from "./IncomeSplitCard";
import { serverMoney } from "@/lib/money-server";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import { estadoDoMes, vozDoTema } from "@/lib/profiles/voice";
import { montarDadosDoTema } from "./theme-hero-data";
import { ThemeHero } from "./ThemeHero";
import { ThemeFooter } from "./ThemeFooter";

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

/** Cor do valor por tipo de lançamento, mesma convenção do resto do app (verde entrada,
 * vermelho saída, dourado aporte). */
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

function toDateInput(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
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
  // Os nomes das categorias na cara do perfil: "Moradia" pra pessoa, "Estrutura" pra empresa.
  const rotulosDeCategoria = Object.fromEntries(PARENT_CATEGORIES.map((k) => [k, categoryLabel(ctx.profileKind, k)]));
  // `serverMoney` entra na leva paralela em vez de ficar sozinho antes dela: sozinho, ele
  // custava uma ida ao banco inteira antes de qualquer outra consulta começar.
  const [
    money,
    entries,
    summary,
    annualSummary,
    yearlySummary,
    monthBudgets,
    yearBudgets,
    recentSubcategories,
    customCategories,
    goals,
    spentByParent,
    spentByCustom,
    onboardingCounts,
    recapDismissedMonth,
    importBatches,
    dailyFlow,
    categorySpending,
    previousSummary,
    aporteSemDestino,
  ] = await Promise.all([
    serverMoney(),
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getAnnualSummary(ctx, year),
    getYearlySummary(ctx, year),
    listBudgets(ctx, year, month),
    listBudgetsForYear(ctx, year),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    // Primeiros passos do onboarding: 1 registro de cada tipo basta pra saber o que falta.
    Promise.all([
      prisma.monthlyEntry.count({ where: { userId: ctx.userId, profileId: ctx.profileId }, take: 1 }),
      prisma.budget.count({ where: { userId: ctx.userId, profileId: ctx.profileId }, take: 1 }),
      prisma.asset.count({ where: { userId: ctx.userId, profileId: ctx.profileId }, take: 1 }),
    ]),
    getRecapDismissedMonth(ctx),
    listImportBatches(ctx),
    getDailyFlow(ctx, year, month),
    getCategorySpending(ctx, year, month, rotulosDeCategoria),
    // Mês anterior: base das comparações ("gastou X% menos que no mês passado").
    getMonthlySummary(ctx, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
    getContributionLinkState(ctx, year, month),
  ]);
  const [entryCount, budgetCount, assetCount] = onboardingCounts;

  // Planejamento = soma dos valores planejados (orçamento). Mensal: só o mês; anual: o ano todo.
  const monthlyPlanned = monthBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);
  const annualPlanned = yearBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);

  const goalOptions = goals.map((g) => ({ id: g.id, name: g.name }));

  // Ritmo do mês: % do orçamento consumido vs. % do mês decorrido, mais honesto que "limite
  // diário" (média), porque gasto não é linear. Só faz sentido no mês corrente e com orçamento.
  // Fuso do Brasil: com o relógio UTC do servidor, das 21h à meia-noite o app acharia que já é
  // o dia (ou mês) seguinte.
  const now = nowInBrazil();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const pacing =
    isCurrentMonth && monthlyPlanned > 0
      ? { budgetUsed: summary.totalExpense / monthlyPlanned, monthElapsed: now.getDate() / daysInMonth }
      : null;

  // Resumo Mensal: só perto da virada do mês (fim ou início), e só se ainda não foi fechado
  // para aquele mês específico — não é um banner permanente.
  const recapEligibility = getRecapEligibility(now, recapDismissedMonth);

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
        name: rotulosDeCategoria[s.parentCategory],
        value: s.spent,
        color: colorForCategorySlice({ kind: "parent", value: s.parentCategory }),
      })),
    ...spentByCustom
      .filter((s) => s.spent > 0)
      .map((s) => ({
        name: customCategoryNameById.get(s.customCategoryId) ?? "Outro",
        value: s.spent,
        color: colorForCategorySlice({ kind: "custom", value: s.customCategoryId }),
      })),
  ];

  // Gasto SEM categoria vira fatia própria. Sem isso, a rosca somava só o que está
  // categorizado e mostrava esse subtotal no centro — dando duas respostas diferentes para
  // "Gastos" na mesma tela (R$ 8.068 no card de cima, R$ 4.500 no centro da rosca) e
  // inflando os percentuais: Moradia aparecia com 89% do mês quando era 50%.
  const uncategorizedSpent = summary.totalExpense - totalSpentByCategory;
  if (uncategorizedSpent > 0) {
    // Cinza mais claro que o de "Outros": os dois são neutros de propósito (nenhum é uma
    // categoria escolhida), mas dizem coisas diferentes — "Outros" é a cauda de categorias
    // pequenas, "Sem categoria" é gasto por classificar, e esse a pessoa consegue resolver.
    spendingSlices.push({
      name: "Sem categoria",
      value: uncategorizedSpent,
      color: "var(--color-ink-muted)",
    });
  }

  // Números viram frase: "gastou 12% menos que no mês passado", "Alimentação subiu 28%".
  // No mês corrente, compara o que saiu ATÉ HOJE (a curva diária já para em hoje) com o mesmo
  // pedaço do mês passado. summary.totalExpense inclui conta datada pra frente, o que inflava
  // o "acima do mês passado" pra quem lança o boleto do dia 25 no dia 10.
  // Lançamento SEM data (toda fatura de cartão importada cai assim, de propósito — "no mês",
  // não "no dia da compra") não entra na curva dia a dia, mas já aconteceu: sem somar
  // `undatedAmount` aqui, quem lançou o mês inteiro via fatura tinha `expenseSoFar` zerado e a
  // frase saía "gastando 100% a menos", mesmo tendo gastado a fatura inteira.
  const expenseSoFar = isCurrentMonth ? (dailyFlow.points.at(-1)?.expense ?? 0) + dailyFlow.undatedAmount : summary.totalExpense;
  const insights = buildMonthInsights({
    currentExpense: expenseSoFar,
    previousExpense: previousSummary.totalExpense,
    categories: categorySpending,
    money,
    // Mês em andamento é comparado com o mesmo pedaço do anterior, não com ele inteiro.
    elapsed: isCurrentMonth ? now.getDate() / daysInMonth : 1,
  });

  // O cartão "Parece que se repete" (recorrência detectada nos meses anteriores) saiu em
  // set/2026 a pedido da Dani: quem usa o app sobe o extrato, e o cartão só repetia o que o
  // extrato já traz. O componente RecurringSuggestions ficou no repositório, sem uso.

  // A voz do tema do perfil: o que a tela diz. Os números são os mesmos nos sete.
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const mesFechado = !isCurrentMonth && !isFutureMonth;
  const estado = estadoDoMes({ income: summary.totalIncome, expense: summary.totalExpense, investment: summary.totalInvestment });
  const dadosDoTema = await montarDadosDoTema(ctx, {
    year, month, now, isCurrentMonth, daysInMonth, mesFechado,
    summary, previousSummary, monthBudgets, spentByParent, categorySpending,
    entriesDoMes: entries.map((e) => ({ category: e.category, amount: Number(e.amount), goalId: e.goalId })),
    money,
  });

  // Empresa: a DRE do mês, calculada das mesmas categorias. Pessoa física não paga a consulta.
  const empresa = ehEmpresa(ctx.profileKind)
    ? await dadosDaEmpresa(
        ctx,
        {
          receita: summary.totalIncome,
          retido: summary.totalInvestment,
          gastoPorCategoria: spentByParent,
          gastoPersonalizado: spentByCustom.reduce((s, c) => s + c.spent, 0),
        },
        { year, month },
      )
    : null;

  const paidDividends = isCurrentMonth
    ? (await listRecentlyPaidDividends(ctx, 10))
        .filter((d) => !d.registered)
        .map((d) => ({
          ticker: d.ticker,
          kind: d.kind,
          paymentDate: d.paymentDate.toISOString().slice(0, 10),
          dateLabel: d.paymentDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
          amount: d.amount,
        }))
    : [];

  // No computador a página vira uma grade de cartões (ver Section): os avisos ficam dois por
  // linha, a leitura do mês ao lado da curva, as duas roscas juntas, o calendário ao lado do
  // ranking. No celular continua uma coluna. `flex-wrap` em vez de `grid` porque quase tudo
  // aqui é condicional: um cartão sozinho cresce e ocupa a linha inteira em vez de deixar um
  // buraco do lado.
  const LADO_A_LADO = "contents lg:flex lg:flex-wrap lg:items-start lg:gap-5 [&>*]:lg:min-w-0 [&>*]:lg:grow [&>*]:lg:basis-[calc(50%-0.625rem)]";

  return (
    <div className="flex flex-col gap-7 lg:gap-5">

      {/* O bloco próprio do tema (ranking, recado, mural, campeão) abre a tela. */}
      <ThemeHero dados={dadosDoTema} money={money} mesLabel={MONTH_LABELS[month - 1]} />

      <div className={LADO_A_LADO}>
        {paidDividends.length > 0 && <PaidDividendsCard items={paidDividends} titulo={voz.titulos.caiuNaConta} sub={voz.titulos.caiuNaContaSub} />}

        <OnboardingChecklist hasEntry={entryCount > 0} hasBudget={budgetCount > 0} hasAsset={assetCount > 0} />

        {isCurrentMonth && recapEligibility.eligible && <MonthlyRecapCard monthKey={recapEligibility.monthKey} />}
      </div>

      <FlowIndicators
        year={year}
        month={month}
        initialView={initialView}
        monthly={monthlyBundle}
        annual={annualBundle}
        pacing={pacing}
        mesFechado={mesFechado}
      />

      {/* Empresa: a DRE logo abaixo do painel. É a conta que a pessoa física não tem. */}
      {empresa && <DreEmpresa dados={empresa} money={money} periodo={MONTH_LABELS[month - 1].toLowerCase()} />}

      {/* A leitura do mês antes do detalhamento: quanto sobrou e o que mudou desde o mês
          passado. Os números acima dizem "quanto"; este bloco diz "e daí". No computador fica
          ao lado da curva do mês: um terço de texto, dois terços de gráfico. */}
      <div className="contents lg:flex lg:flex-wrap lg:gap-5 [&>*]:lg:min-w-0 [&>*]:lg:grow">
      <div className="contents lg:block lg:basis-[calc(33.333%-0.625rem)]">
      <MonthHighlight
        income={summary.totalIncome}
        expense={summary.totalExpense}
        investment={summary.totalInvestment}
        insights={insights}
        titulo={voz.titulos.oQueMudou}
      />
      </div>

      {/* O aporte do mês que ainda não virou ativo nenhum. Sem esse aviso, a pessoa lançava o
          aporte aqui, ia na carteira e não via nada mudar — e achava que o app tinha perdido o
          dinheiro dela. O link leva pro lugar onde ela diz em quais ativos entrou. */}
      {aporteSemDestino.pending > 0 && (
        <Link
          href="/carteira"
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft/30 px-4 py-3 transition-colors hover:border-accent"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">
              {money(aporteSemDestino.pending, { round: true })} aportados neste mês ainda não estão na carteira
            </span>
            <span className="block text-caption text-ink-muted">Diga em quais ativos esse dinheiro entrou e suas metas andam junto.</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-accent-strong">Dizer onde foi →</span>
        </Link>
      )}

      {/* Curva do mês dia a dia — o gráfico que faltava pra enxergar o ritmo, não só o total. */}
      <div className="contents lg:block lg:basis-[calc(66.666%-0.625rem)]">
      <MonthFlowCard flow={dailyFlow} monthLabel={MONTH_LABELS[month - 1]} isCurrentMonth={isCurrentMonth} isFutureMonth={isFutureMonth} voz={voz} />
      </div>
      </div>

      {/* Duas roscas que respondem perguntas diferentes: a primeira divide a RENDA (quanto do
          que entrou virou gasto, aporte e sobra), a segunda abre os GASTOS por categoria. */}
      <div className="grid gap-7 lg:grid-cols-2 lg:gap-5">
        <IncomeSplitCard
          income={summary.totalIncome}
          expense={summary.totalExpense}
          investment={summary.totalInvestment}
          balance={summary.balance}
          voz={voz}
        />
        {totalSpentByCategory > 0 && (
          <Section
            title={voz.titulos.paraOndeFoi}
            action={
              <Link href="/mensal/gastos" className="text-caption font-medium text-accent-strong hover:underline">
                ver lançamentos →
              </Link>
            }
          >
            <Donut slices={spendingSlices} centerLabel="Gastos" size={160} />
          </Section>
        )}
      </div>

      {/* Depois da rosca (PARA ONDE foi) e antes do ranking (QUANTO foi), o QUANDO: é a única
          das três perguntas que o app tinha como responder e não respondia. No computador o
          calendário e o ranking dividem a linha. */}
      <div className={LADO_A_LADO}>
      {dailyFlow.points.some((p) => p.expenseOfDay > 0) && (
        <Section title={voz.titulos.ritmoDoMes} hint={voz.titulos.uiHeatmapDica}>
          <MonthHeatmap points={dailyFlow.points} daysInMonth={dailyFlow.daysInMonth} year={year} month={month} voz={voz} />
        </Section>
      )}

      {/* O ranking completa a rosca: ela mostra a fatia, ele mostra quanto exatamente e o que
          mudou desde o mês passado. */}
      <TopCategories categories={categorySpending} tema={ctx.profileTheme} kind={ctx.profileKind} voz={voz} />
      </div>

      {/* O botão "Registrar" (drawer global) já cobre lançamento; aqui embaixo, algo pra olhar
          todo dia em vez de outro formulário repetido: renda/gastos/aportes mês a mês no ano. */}
      <Section title={voz.titulos.anoMesAMes}>
        <YearlyBarChart months={yearlySummary.months} />
      </Section>

      <BudgetSection ctx={ctx} year={year} month={month} totalIncome={summary.totalIncome} />

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} message={voz.mesVazio} />
      ) : (
        <EntryList
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goalOptions}
          entries={entries.map((entry) => ({
            id: entry.id,
            category: entry.category,
            parentCategory: entry.parentCategory,
            customCategoryId: entry.customCategoryId,
            subcategory: entry.subcategory,
            description: entry.description,
            amount: Number(entry.amount),
            entryDate: toDateInput(entry.entryDate),
            dayLabel: formatRelativeDay(entry.entryDate),
            goalId: entry.goalId,
            ...(entry.originalCurrency && entry.originalAmount !== null && isCurrencyCode(entry.originalCurrency)
              ? {
                  originalLabel: formatMoney(Number(entry.originalAmount), entry.originalCurrency),
                  originalAmount: Number(entry.originalAmount),
                  originalCurrency: entry.originalCurrency,
                  exchangeRate: entry.exchangeRate === null ? null : Number(entry.exchangeRate),
                }
              : {}),
          }))}
        />
      )}

      {/* Histórico do que foi importado em massa, com "Desfazer" por lote (upload errado ou
          duplicado some inteiro, sem caçar lançamento por lançamento). */}
      <ImportHistory
        batches={importBatches.map((b) => ({
          id: b.id,
          docType: b.docType,
          fileName: b.fileName,
          createdAt: b.createdAt.toISOString(),
          entryCount: b.entryCount,
          totalAmount: b.totalAmount,
          months: b.months,
        }))}
      />

      <ThemeFooter texto={voz.rodape(estado)} />
    </div>
  );
}
