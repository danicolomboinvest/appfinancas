import Link from "next/link";
import { ShieldCheck, Target, Sparkles, Coins, ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { sumUpcomingDividends } from "@/lib/repositories/dividend.repo";
import { getAnnualPlannedVsActual, compareCategoryBudget } from "@/lib/planning/budget-comparison";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory, sumExpensesByParentCategoryForYear, sumExpensesByCustomCategoryForYear } from "@/lib/repositories/budget.repo";
import { countRecentDatedEntries } from "@/lib/repositories/monthly-entry.repo";
import { buildWeeklyTasks } from "@/lib/insights/weekly-tasks";
import { WeeklyTasksCard } from "@/components/shell/WeeklyTasksCard";
import { computeGoalPlan } from "@/lib/planning/goal";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { FitText } from "@/components/ui/FitText";
import { CountUp } from "@/components/ui/CountUp";
import { LinkedStatCard } from "@/components/ui/LinkedStatCard";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { listMonthlyEntries } from "@/lib/repositories/monthly-entry.repo";
import { getCategorySpending } from "@/lib/consolidation/month-analysis";
import { PARENT_CATEGORIES, categoryLabel } from "@/lib/categories";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { dadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { ehCasal } from "@/lib/profiles/casal";
import { PainelEmpresa } from "./PainelEmpresa";
import type { ParentCategory } from "@prisma/client";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { sumIncomeBySubcategory } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { montarDadosDoTema } from "@/app/(app)/mensal/[year]/[month]/theme-hero-data";
import { ThemeHero } from "@/app/(app)/mensal/[year]/[month]/ThemeHero";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_LABELS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];


/** Variação percentual entre o mês atual e o anterior, null quando não dá para comparar (mês anterior zerado). */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * Diferença em R$ entre o mês atual e o anterior, usada só para o saldo, em vez de %.
 * Perto de zero (ou quando não há renda no mês), o saldo tende a ficar bem próximo do gasto
 * invertido (saldo = renda - gastos - aportes, e com renda/aportes zerados vira -gastos), o
 * que faz a variação percentual do saldo coincidir com a dos gastos por pura matemática —
 * parecendo um bug de "número repetido" sem ser. Um delta em R$ não sofre dessa ilusão.
 */
function changeAmount(current: number, previous: number): number | null {
  if (current === previous) return null;
  return current - previous;
}

function firstOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const money = await serverMoney();
  const searchParams = await props.searchParams;
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const empresa = ehEmpresa(ctx.profileKind);
  const rotulosDeCategoria = Object.fromEntries(PARENT_CATEGORIES.map((k) => [k, categoryLabel(ctx.profileKind, k)]));
  // Fuso do Brasil, o relógio UTC do servidor viraria o ano mais cedo na noite de 31/12.
  const now = nowInBrazil();

  // Ano selecionável via ?year, as setas do cabeçalho navegam por aqui.
  const yearParam = Number(firstOf(searchParams.year));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getFullYear();
  const isCurrentYear = year === now.getFullYear();

  // Mês de referência da comparação "vs mês passado": o mês atual no ano corrente; em anos
  // passados, dezembro (último mês fechado do ano).
  const currentMonth = isCurrentYear ? now.getMonth() + 1 : 12;
  const previousMonthDate = new Date(year, currentMonth - 2, 1);

  const [
    summary,
    portfolio,
    emergencyFund,
    goals,
    planningParams,
    currentMonthSummary,
    previousMonthSummary,
    plannedVsActual,
    upcomingDividends,
    entriesThisWeek,
    monthBudgets,
    spentByParent,
    spentByCustom,
  ] = await Promise.all([
    getYearlySummary(ctx, year),
    getPortfolioByObjective(ctx),
    getEmergencyFund(ctx),
    listGoals(ctx),
    getPlanningParams(ctx),
    getMonthlySummary(ctx, year, currentMonth),
    getMonthlySummary(ctx, previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1),
    getAnnualPlannedVsActual(ctx, year),
    sumUpcomingDividends(ctx, 30),
    countRecentDatedEntries(ctx, 7),
    listBudgets(ctx, year, currentMonth),
    sumExpensesByParentCategory(ctx, year, currentMonth),
    sumExpensesByCustomCategory(ctx, year, currentMonth),
  ]);

  const plannedByMonth = Object.fromEntries(
    plannedVsActual.months.map((m) => [m.month, m.totalPlanned]),
  ) as Record<number, number>;

  // O número do card é do ANO; a comparação é de mês contra mês. Com "vs. mês passado" colado
  // num total anual, os 14% pareciam ser sobre o ano inteiro. Dizer o NOME do mês já entrega
  // que a comparação é mensal, sem trocar a métrica.
  const rotuloComparacao = MONTH_LABELS_FULL[previousMonthDate.getMonth()].toLowerCase();
  const rotuloMesAtual = MONTH_LABELS_FULL[currentMonth - 1].toLowerCase();
  const incomeTrend = changePercent(currentMonthSummary.totalIncome, previousMonthSummary.totalIncome);
  const expenseTrend = changePercent(currentMonthSummary.totalExpense, previousMonthSummary.totalExpense);
  const balanceDelta = changeAmount(currentMonthSummary.balance, previousMonthSummary.balance);

  const monthsSoFar = summary.months.filter((m) => m.isRealized);
  const incomeSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.totalIncome }));
  const expenseSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.totalExpense }));
  const balanceSparkline = monthsSoFar.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.balance }));

  const emergencyTarget = emergencyFund ? Number(emergencyFund.targetAmount) : null;
  const emergencyCurrent = emergencyFund ? Number(emergencyFund.currentAmount) : 0;
  const emergencyProgress = emergencyTarget && emergencyTarget > 0 ? emergencyCurrent / emergencyTarget : null;

  const goalStatuses = goals.map((goal) =>
    computeGoalPlan({
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate ?? new Date(),
      annualRate: Number(goal.annualRate ?? 0),
      startedAt: goal.createdAt,
    }).status,
  );
  const goalsOnTrack = goalStatuses.filter((status) => status === "ON_TRACK" || status === "ACHIEVED").length;
  const goalsBehind = goalStatuses.filter((status) => status === "BEHIND" || status === "NOT_STARTED").length;

  // Checklist da semana: quantas categorias já passaram do que foi planejado no mês corrente.
  // Gasto de categoria sem plano não conta como "estouro" — não havia teto pra estourar.
  const spentByKey = new Map<string, number>([
    ...spentByParent.map((s) => [`parent:${s.parentCategory}`, s.spent] as const),
    ...spentByCustom.map((s) => [`custom:${s.customCategoryId}`, s.spent] as const),
  ]);
  const overBudgetCount = monthBudgets.filter((budget) => {
    const key = budget.parentCategory
      ? `parent:${budget.parentCategory}`
      : budget.customCategoryId
        ? `custom:${budget.customCategoryId}`
        : null;
    if (!key) return false;
    return compareCategoryBudget(Number(budget.plannedAmount), spentByKey.get(key) ?? 0).status === "ACIMA";
  }).length;

  const weeklyTasks = buildWeeklyTasks({
    entriesThisWeek,
    hasBudget: monthBudgets.some((b) => Number(b.plannedAmount) > 0),
    overBudgetCount,
    emergencyProgress,
    goalCount: goals.length,
    goalsBehind,
    investedThisMonth: currentMonthSummary.totalInvestment,
  });
  // Casal: uma tarefa a mais, a prática mais recomendada pra evitar que dinheiro vire briga
  // (pesquisa Serasa: dinheiro é o motivo nº 1 de conflito de casal) — uma conversa curta e
  // periódica sobre os gastos, não uma cobrança. Sempre aberta: não tem "feito" pra marcar,
  // é recorrente toda semana.
  if (ehCasal(ctx.profileKind)) {
    weeklyTasks.push({ key: "reuniao-casal", label: "Combinar 15 min pra olhar os gastos do mês juntos", done: false, href: "/mensal" });
  }

  // Empresa: o painel de negócio (DRE do mês e do ano, receita por tipo, gasto por frente do
  // mês anterior, plano de receita). Pessoa física não paga nenhuma dessas consultas.
  const painelEmpresa = empresa
    ? await (async () => {
        const mesAnterior = { year: previousMonthDate.getFullYear(), month: previousMonthDate.getMonth() + 1 };
        const [porMaeAno, porPersonalizadaAno, porMaeMesAnterior, receitaPorTipoAno, receitaPorTipoMes, planoDoMes, categoriasPersonalizadas] = await Promise.all([
          sumExpensesByParentCategoryForYear(ctx, year),
          sumExpensesByCustomCategoryForYear(ctx, year),
          sumExpensesByParentCategory(ctx, mesAnterior.year, mesAnterior.month),
          sumIncomeBySubcategory(ctx, year),
          sumIncomeBySubcategory(ctx, year, currentMonth),
          getMonthlyPlan(ctx, year, currentMonth),
          listCustomCategories(ctx),
        ]);
        const gastoPersonalizadoMes = spentByCustom.reduce((s, r) => s + r.spent, 0);
        const [mes, ano] = await Promise.all([
          dadosDaEmpresa(ctx, { receita: currentMonthSummary.totalIncome, retido: currentMonthSummary.totalInvestment, gastoPorCategoria: spentByParent, gastoPersonalizado: gastoPersonalizadoMes }, { year, month: currentMonth }),
          dadosDaEmpresa(
            ctx,
            {
              receita: summary.totalIncome,
              retido: summary.totalInvestment,
              gastoPorCategoria: porMaeAno.map((r) => ({ parentCategory: r.parentCategory, spent: r.spent })),
              gastoPersonalizado: porPersonalizadaAno.reduce((s, r) => s + r.spent, 0),
            },
            { year, month: currentMonth },
          ),
        ]);
        const nomeDaPersonalizada = new Map(categoriasPersonalizadas.map((c) => [c.id, c.name]));
        const orcamentoPorFrente = Object.fromEntries(
          monthBudgets.filter((b) => b.parentCategory).map((b) => [b.parentCategory as string, Number(b.plannedAmount)]),
        ) as Partial<Record<ParentCategory, number>>;
        return (
          <PainelEmpresa
            money={money}
            year={year}
            mesLabel={MONTH_LABELS_FULL[currentMonth - 1]}
            mesAnteriorLabel={rotuloComparacao}
            isCurrentYear={isCurrentYear}
            months={summary.months}
            mes={mes}
            ano={ano}
            receita={{ atual: currentMonthSummary.totalIncome, anterior: previousMonthSummary.totalIncome }}
            despesas={{ atual: currentMonthSummary.totalExpense, anterior: previousMonthSummary.totalExpense }}
            lucro={{ atual: currentMonthSummary.totalIncome - currentMonthSummary.totalExpense, anterior: previousMonthSummary.totalIncome - previousMonthSummary.totalExpense }}
            gastoPorFrenteMes={spentByParent}
            gastoPorFrenteMesAnterior={porMaeMesAnterior}
            orcamentoPorFrente={orcamentoPorFrente}
            gastoPersonalizadoMes={spentByCustom.map((c) => ({ id: c.customCategoryId, name: nomeDaPersonalizada.get(c.customCategoryId) ?? "Personalizada", spent: c.spent }))}
            receitaPorTipoAno={receitaPorTipoAno}
            receitaPorTipoMes={receitaPorTipoMes}
            orcamentoDoMes={monthBudgets.reduce((s, b) => s + Number(b.plannedAmount), 0)}
            receitaPlanejadaDoMes={planoDoMes && planoDoMes.plannedIncome > 0 ? planoDoMes.plannedIncome : null}
          />
        );
      })()
    : null;

  // O bloco próprio do tema (ranking, recado, mural, campeão) também abre a Visão geral —
  // senão o tema só existia no Fluxo. Só no ano corrente, e só os temas que têm bloco pagam
  // as duas consultas a mais (categorias e lançamentos do mês).
  const temBloco = ["game", "disciplina", "manifestacao", "semfiltro"].includes(ctx.profileTheme);
  const [categorySpending, entriesDoMes] = isCurrentYear && temBloco
    ? await Promise.all([getCategorySpending(ctx, year, currentMonth, rotulosDeCategoria), listMonthlyEntries(ctx, year, currentMonth)])
    : [[], []];
  const daysInMonth = new Date(year, currentMonth, 0).getDate();
  const dadosDoTema = isCurrentYear && temBloco
    ? await montarDadosDoTema(ctx, {
        year, month: currentMonth, now, isCurrentMonth: true, daysInMonth, mesFechado: false,
        summary: currentMonthSummary, previousSummary: previousMonthSummary,
        monthBudgets, spentByParent, categorySpending,
        entriesDoMes: entriesDoMes.map((e) => ({ category: e.category, amount: Number(e.amount), goalId: e.goalId })),
        money,
      })
    : null;

  let usufructSurplus: number | null = null;
  if (planningParams) {
    const accumulation = computeAccumulation({
      currentAge: planningParams.currentAge,
      retirementAge: planningParams.retirementAge,
      currentPatrimony: Number(planningParams.currentPatrimony),
      monthlyContributionAccumulation: Number(planningParams.monthlyContributionAccumulation),
      accumulationAnnualRate: Number(planningParams.accumulationAnnualRate),
      inflationAnnualRate: Number(planningParams.inflationAnnualRate),
    });
    const usufruct = computeUsufruct({
      finalValueReal: accumulation.finalValueReal,
      usufructAnnualRate: Number(planningParams.usufructAnnualRate),
      otherPassiveIncome: Number(planningParams.otherPassiveIncome),
      desiredPassiveIncome: Number(planningParams.desiredPassiveIncome),
    });
    usufructSurplus = usufruct.surplusOrDeficit;
  }

  return (
    <div className="flex flex-col gap-8 lg:gap-5">
      <PageHeader
        title={voz.titulos.visaoGeral}
        subtitle={
          <>
            {voz.titulos.visaoGeralSub.replace("{ano}", String(year))}{" "}
            <Link href={`/mensal/${year}`} className="text-accent-strong hover:underline">
              {voz.titulos.visaoGeralLink}
            </Link>
          </>
        }
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard?year=${year - 1}`}
              aria-label={`Ano ${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/dashboard?year=${year + 1}`}
              aria-label={`Ano ${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      {!empresa && (
      <>
      {/* O patrimônio total. Já foi um número de 52px numa caixa com brilho; a Dani achou
          gritante. Agora é um cartão baixo com ícone, rótulo e número de 32px, o mesmo desenho
          do total da carteira. */}
      <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft/30 p-4 sm:gap-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Briefcase size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{voz.titulos.patrimonio}</p>
          <div className="mt-0.5">
            <FitText className="text-display font-semibold tracking-tight text-accent-strong">
              {/* `brl` (não uma função): função não atravessa a fronteira server→client. */}
              <CountUp value={portfolio.totalPortfolio} brl />
            </FitText>
          </div>
        </div>
      </div>

      {dadosDoTema && <ThemeHero dados={dadosDoTema} money={money} mesLabel={MONTH_LABELS_FULL[currentMonth - 1]} />}

      {/* Três linhas no celular (some o card órfão da grade de dois) e três colunas no
          computador, que é onde a grade de três funciona de verdade. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <StatCard
          layout="row"
          label={voz.titulos.rendaNoAno}
          value={money(summary.totalIncome)}
          tone="success"
          trend={incomeTrend === null ? undefined : { percent: incomeTrend, periodLabel: rotuloComparacao, scopeLabel: rotuloMesAtual }}
          sparkline={incomeSparkline}
        />
        <StatCard
          layout="row"
          label={voz.titulos.gastosNoAno}
          value={money(summary.totalExpense)}
          tone="neutral"
          trend={
            expenseTrend === null
              ? undefined
              : { percent: expenseTrend, periodLabel: rotuloComparacao, scopeLabel: rotuloMesAtual, goodDirection: "down" }
          }
          sparkline={expenseSparkline}
        />
        <StatCard
          layout="row"
          label={voz.titulos.sobrouNoAno}
          value={money(summary.balance)}
          tone="accent"
          hint={
            summary.savingsRate === null
              ? undefined
              : voz.titulos.sobrouNoAnoDica(money(100, { round: true }), money(Math.round(summary.savingsRate * 100), { round: true }), Math.round(summary.savingsRate * 100))
          }
          trend={
            balanceDelta === null
              ? undefined
              : {
                  percent: balanceDelta,
                  periodLabel: rotuloComparacao,
                  scopeLabel: rotuloMesAtual,
                  displayValue: money(Math.abs(balanceDelta), { round: true }),
                }
          }
          sparkline={balanceSparkline}
        />
      </div>

      </>
      )}
      {painelEmpresa}

      {/* Próximos passos antes do status: o painel dizia como as coisas ESTÃO, mas não o que
          fazer a seguir — e é aí que a maioria abre o app, olha, e não volta. */}
      {/* No computador, a lista da semana e o status dos módulos dividem a linha. */}
      <div className="contents lg:flex lg:flex-wrap lg:items-start lg:gap-5 [&>*]:lg:min-w-0 [&>*]:lg:grow [&>*]:lg:basis-[calc(50%-0.625rem)]">
      {isCurrentYear && (
        <WeeklyTasksCard
          titulo={voz.titulos.semanaTitulo}
          tasks={weeklyTasks.map((t) => ({ ...t, label: voz.titulos.tarefa(t.key, t.label, t.done) }))}
        />
      )}

      <Section title={voz.titulos.statusModulos}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2">
          <LinkedStatCard
            href="/planejamento/reserva-emergencia"
            icon={ShieldCheck}
            label={voz.titulos.modReserva}
            value={emergencyProgress === null ? "Não configurada" : `${Math.round(emergencyProgress * 100)}% concluída`}
            hint={emergencyTarget !== null ? `${money(emergencyCurrent, { round: true })} de ${money(emergencyTarget, { round: true })}` : "Configure sua meta"}
            progressPercent={emergencyProgress ?? undefined}
            tone={emergencyProgress === null ? "neutral" : emergencyProgress >= 1 ? "accent" : "success"}
          />
          <LinkedStatCard
            href="/planejamento/metas"
            icon={Target}
            label={voz.titulos.modMetas}
            value={goals.length === 0 ? "Nenhuma meta" : `${goalsOnTrack} no ritmo`}
            hint={
              goals.length === 0
                ? "Cadastre sua primeira meta"
                : goalsBehind > 0
                  ? `${goalsBehind} atrasada${goalsBehind === 1 ? "" : "s"} · ${goals.length} no total`
                  : `${goals.length} meta${goals.length === 1 ? "" : "s"} no total`
            }
            tone={goalsBehind > 0 ? "danger" : "success"}
          />
          {/* Empresa não se aposenta: o card some no perfil Empresa. */}
          {!empresa && (
          <LinkedStatCard
            href="/planejamento/acumulo#liberdade-financeira"
            icon={Sparkles}
            label={voz.titulos.modAposentadoria}
            value={usufructSurplus === null ? "Não configurada" : money(usufructSurplus)}
            hint={
              usufructSurplus === null
                ? "Configure seu planejamento"
                : usufructSurplus >= 0
                  ? "Superávit: renda passiva cobre o padrão de vida desejado"
                  : "Déficit: falta patrimônio para o padrão de vida desejado"
            }
            tone={usufructSurplus === null ? "neutral" : usufructSurplus >= 0 ? "success" : "danger"}
          />
          )}
          <LinkedStatCard
            href="/carteira#dividendos"
            icon={Coins}
            label={voz.titulos.modDividendos}
            value={upcomingDividends > 0 ? money(upcomingDividends) : "Nenhum previsto"}
            hint={upcomingDividends > 0 ? "Estimativa dos ativos da sua carteira" : "Aparece quando houver provento anunciado"}
            tone={upcomingDividends > 0 ? "success" : "neutral"}
          />
        </div>
      </Section>
      </div>

      {/* Na empresa o painel já desenha receita × despesas × lucro; este era o mesmo ano de novo. */}
      {!empresa && (
        <Section title={voz.titulos.anoMesAMes}>
          <YearlyBarChart months={summary.months} plannedByMonth={plannedByMonth} />
        </Section>
      )}
    </div>
  );
}
