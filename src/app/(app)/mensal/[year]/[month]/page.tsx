import { PaidDividendsCard } from "./PaidDividendsCard";
import { listRecentlyPaidDividends } from "@/lib/repositories/dividend.repo";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { ehDoCartao } from "@/lib/cartao/limite";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import {
  sumExpensesByParentCategory,
  sumExpensesByCustomCategory,
  listBudgets,
  listBudgetsForYear,
} from "@/lib/repositories/budget.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getDailyFlow, getCategorySpending } from "@/lib/consolidation/month-analysis";
import { buildMonthInsights } from "@/lib/insights/month-insights";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getRecapDismissedMonth } from "@/lib/repositories/user.repo";
import { getRecapEligibility } from "@/lib/recap/monthly";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PARENT_CATEGORIES, categoryLabel } from "@/lib/categories";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { dadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { DreEmpresa } from "./DreEmpresa";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { MonthHeatmap } from "@/components/charts/MonthHeatmap";
import { EntryList } from "./EntryList";
import { ImportHistory } from "./ImportHistory";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { MonthlyRecapCard } from "./MonthlyRecapCard";
import { FlowIndicators, type FlowBundle } from "./FlowIndicators";
import { MonthHighlight } from "./MonthHighlight";
import { MonthFlowCard } from "./MonthFlowCard";
import { TopCategories } from "./TopCategories";
import { MaisGraficos } from "./MaisGraficos";
import { serverMoney, valoresOcultos } from "@/lib/money-server";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import { estadoDoMes, vozDoTema } from "@/lib/profiles/voice";
import { montarDadosDoTema } from "./theme-hero-data";
import { ThemeHero } from "./ThemeHero";
import { ThemeFooter } from "./ThemeFooter";
import { PrimeiroPassoDoMes } from "./PrimeiroPassoDoMes";
import { prisma } from "@/lib/db/prisma";
import { BotoesDeLancar } from "@/components/ui/BotoesDeLancar";

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
  const ocultos = await valoresOcultos();
  // Os nomes das categorias na cara do perfil: "Moradia" pra pessoa, "Estrutura" pra empresa.
  const rotulosDeCategoria = Object.fromEntries(PARENT_CATEGORIES.map((k) => [k, categoryLabel(ctx.categorias ?? ctx.profileKind, k)]));
  // `serverMoney` entra na leva paralela em vez de ficar sozinho antes dela: sozinho, ele
  // custava uma ida ao banco inteira antes de qualquer outra consulta começar.
  const [
    money,
    entries,
    summary,
    yearlySummary,
    monthBudgets,
    yearBudgets,
    recentSubcategories,
    customCategories,
    goals,
    spentByParent,
    spentByCustom,
    recapDismissedMonth,
    importBatches,
    dailyFlow,
    categorySpending,
    previousSummary,
  ] = await Promise.all([
    serverMoney(),
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getYearlySummary(ctx, year),
    listBudgets(ctx, year, month),
    listBudgetsForYear(ctx, year),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    getRecapDismissedMonth(ctx),
    listImportBatches(ctx),
    getDailyFlow(ctx, year, month),
    getCategorySpending(ctx, year, month, rotulosDeCategoria),
    // Mês anterior: base das comparações ("gastou X% menos que no mês passado").
    getMonthlySummary(ctx, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
  ]);

  // Conta nova: nenhum lançamento em NENHUM mês deste perfil. Aí a tela inteira seria cartão
  // zerado ("Entrou R$ 0", roscas vazias, calendário em branco) — no lugar, um passo só:
  // importar o extrato. Mês vazio de quem já usa o app (um mês futuro, o dia 1º) continua com
  // a tela de sempre. A consulta extra só roda quando o mês aberto está vazio.
  const contaNova =
    entries.length === 0 &&
    !(await prisma.monthlyEntry.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } }));
  if (contaNova) {
    const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
    return (
      <PrimeiroPassoDoMes
        titulo={t.uiMesNovoTitulo}
        texto={t.uiMesNovoTexto}
        importar={t.uiMesNovoImportar}
        digitar={t.uiMesNovoDigitar}
        ajuda={t.uiMesNovoAjuda}
        confianca={t.uiMesNovoConfianca}
      />
    );
  }

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
  // Visão "Anual": só os meses que já aconteceram, os mesmos totais da tela do ano
  // (/mensal/[year]). A soma dos 12 meses entrava com o aluguel de outubro a dezembro que a
  // recorrência já criou, e o "Gastou" e o "Resultado" do ano davam números diferentes nas
  // duas telas.
  const annualBundle: FlowBundle = {
    income: yearlySummary.totalIncome,
    expense: yearlySummary.totalExpense,
    planned: annualPlanned,
    investment: yearlySummary.totalInvestment,
    balance: yearlySummary.balance,
  };

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
          // O que não tem categoria entra como despesa fixa (a mesma fatia "Sem categoria" da rosca).
          despesaTotal: summary.totalExpense,
        },
        { year, month },
      )
    : null;

  const paidDividends = isCurrentMonth
    ? (await listRecentlyPaidDividends(ctx, 10))
        .filter((d) => !d.registered)
        .map((d) => ({
          id: d.id,
          ticker: d.ticker,
          kind: d.kind,
          paymentDate: d.paymentDate.toISOString().slice(0, 10),
          dateLabel: d.paymentDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
          amount: d.amount,
        }))
    : [];


  // O Mensal na regra "mesma cara, menos texto" (07/10/2026, aprovada pela Dani): os quatro
  // quadrados do mês em cima, os avisos numa linha cada, UMA lista de categorias e os gráficos em
  // botões. Saíram a rosca "Como sua renda foi dividida" (repetia os quadrados) e a rosca "Para
  // onde foi" (repetia a lista de categorias): o "Gastou" aparecia cinco vezes na mesma tela.
  const graficos = [
    ...(dailyFlow.points.some((p) => p.income > 0 || p.expense > 0)
      ? [{ chave: "dia", rotulo: "Dia a dia", conteudo: <MonthFlowCard flow={dailyFlow} monthLabel={MONTH_LABELS[month - 1]} isCurrentMonth={isCurrentMonth} isFutureMonth={isFutureMonth} voz={voz} /> }]
      : []),
    ...(dailyFlow.points.some((p) => p.expenseOfDay > 0)
      ? [{
          chave: "ritmo",
          rotulo: voz.titulos.ritmoDoMes,
          conteudo: (
            <Section title={voz.titulos.ritmoDoMes} hint={voz.titulos.uiHeatmapDica}>
              <MonthHeatmap points={dailyFlow.points} daysInMonth={dailyFlow.daysInMonth} year={year} month={month} voz={voz} />
            </Section>
          ),
        }]
      : []),
    {
      chave: "ano",
      rotulo: "Mês a mês",
      conteudo: (
        <Section title={voz.titulos.anoMesAMes}>
          <YearlyBarChart months={yearlySummary.months} />
        </Section>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 lg:gap-5">

      {/* O bloco próprio do tema abre a tela — nos meses passados. O do mês atual mora na aba
          Foco, junto com o "o que mudou" e o checklist de primeiros passos. */}
      {!isCurrentMonth && <ThemeHero dados={dadosDoTema} money={money} mesLabel={MONTH_LABELS[month - 1]} />}

      <FlowIndicators year={year} month={month} initialView={initialView} monthly={monthlyBundle} annual={annualBundle} />

      {/* Os avisos depois dos números: cada um numa linha, dois por linha no computador. */}
      {(paidDividends.length > 0 || (isCurrentMonth && recapEligibility.eligible)) && (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
          {paidDividends.length > 0 && <PaidDividendsCard items={paidDividends} titulo={voz.titulos.caiuNaConta} sub={voz.titulos.caiuNaContaSub} />}
          {isCurrentMonth && recapEligibility.eligible && <MonthlyRecapCard monthKey={recapEligibility.monthKey} />}
        </div>
      )}

      {/* Empresa: a DRE logo abaixo do painel. É a conta que a pessoa física não tem. */}
      {empresa && <DreEmpresa dados={empresa} money={money} periodo={MONTH_LABELS[month - 1].toLowerCase()} />}

      {/* Mês que já fechou: o que mudou desde o anterior. */}
      {!isCurrentMonth && (
        <MonthHighlight income={summary.totalIncome} expense={summary.totalExpense} investment={summary.totalInvestment} insights={insights} titulo={voz.titulos.oQueMudou} />
      )}

      {/* O aviso "R$ X guardados ainda não estão na carteira" saiu daqui em 06/10/2026: a Dani
          pediu que virasse o botão "Atualizar aportes" na própria Carteira, onde a tarefa é feita. */}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        <TopCategories categories={categorySpending} tema={ctx.profileTheme} kind={ctx.categorias ?? ctx.profileKind} voz={voz} />
        <MaisGraficos opcoes={graficos} />
      </div>

      {/* O "Orçamento por categoria" saiu daqui (06/10/2026): eram as mesmas barras da aba
          Orçamento, duas telas iguais. O "de X planejados ›" do painel leva até lá. */}

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} message={voz.mesVazio} action={<BotoesDeLancar rotulo="Adicionar lançamento" />} />
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
            recurrenceId: entry.recurrenceId,
            pessoa: entry.pessoa,
            doCasal: entry.doCasal,
            noCartao: ehDoCartao(entry),
            ...(entry.originalCurrency && entry.originalAmount !== null && isCurrencyCode(entry.originalCurrency)
              ? {
                  // O olho do topo fechado esconde também o valor na moeda de origem.
                  originalLabel: ocultos ? "••••" : formatMoney(Number(entry.originalAmount), entry.originalCurrency),
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
