import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { sumExpensesByParentCategory, listBudgets } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL, isParentCategoryKey } from "@/lib/categories";
import { computeGoalPlan } from "@/lib/planning/goal";
import { getAnnualPlannedVsActual, computeOverBudgetStreak } from "@/lib/planning/budget-comparison";
import { nper } from "@/lib/finance/nper";
import { getPortfolioStrategyComparison, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import {
  recordPatrimonySnapshotIfNeeded,
  getPatrimonySnapshotMonthsAgo,
  getPatrimonyAllTimeHighBeforeToday,
} from "@/lib/portfolio/snapshot";
import { formatPercentNumber } from "@/lib/format";

export type InsightTone = "success" | "warning" | "danger" | "info";
export type InsightCategory = "fluxo" | "metas" | "carteira" | "reserva";
export type Insight = {
  id: string;
  message: string;
  tone: InsightTone;
  category: InsightCategory;
  /** Link para a tela onde o usuário pode agir sobre este insight (ajustar orçamento, ver meta, etc.). */
  href?: string;
  /** Rótulo do link de ação — só usado quando `href` está presente. */
  actionLabel?: string;
};

/** Ordem de prioridade para exibição: o que precisa de atenção primeiro, o puramente informativo por último. */
const TONE_PRIORITY: Record<InsightTone, number> = { danger: 0, warning: 1, success: 2, info: 3 };

function sortByPriority(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

/** Meses anteriores ao atual usados para calcular a taxa de poupança "média pessoal". */
const TRAILING_MONTHS_FOR_AVERAGE = 6;

/**
 * Gera cards de insight automáticos a partir de Fluxo Financeiro (orçamento), Metas, Carteira
 * (estratégia e patrimônio) e Reserva de Emergência. Respeita as preferências de notificação
 * do usuário (orçamento estourado / metas atrasadas) definidas em Configurações. Cada insight
 * carrega uma `category` para permitir agrupar a tela de Análises por domínio.
 */
export async function computeInsights(ctx: AuthContext): Promise<Insight[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    user,
    budgets,
    spentByCategory,
    goals,
    emergencyFund,
    strategyComparison,
    portfolio,
    currentMonthSummary,
    annualBudgetComparison,
    customCategories,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId } }),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    prisma.goal.findMany({ where: { userId: ctx.userId } }),
    prisma.emergencyFund.findUnique({ where: { userId: ctx.userId } }),
    getPortfolioStrategyComparison(ctx),
    getPortfolioByObjective(ctx),
    getMonthlySummary(ctx, year, month),
    getAnnualPlannedVsActual(ctx, year),
    listCustomCategories(ctx),
  ]);

  const customCategoryLabels = new Map(customCategories.map((c) => [c.id, c.name]));
  /** Rótulo de uma categoria a partir da `categoryKey` (ParentCategory ou id de CustomCategory). */
  function categoryLabel(categoryKey: string): string {
    return isParentCategoryKey(categoryKey)
      ? PARENT_CATEGORY_LABEL[categoryKey]
      : (customCategoryLabels.get(categoryKey) ?? "Categoria personalizada");
  }
  const allCategoryKeys: string[] = [...PARENT_CATEGORIES, ...customCategories.map((c) => c.id)];

  const insights: Insight[] = [];
  const notifyBudget = user?.notifyBudgetAlerts ?? true;
  const notifyGoals = user?.notifyLateGoals ?? true;

  // --- Fluxo Financeiro ---

  const monthlyEntryHref = `/mensal/${year}/${month}`;

  if (notifyBudget) {
    const spentMap = new Map(spentByCategory.map((s) => [s.parentCategory, s.spent]));
    // budgets inclui linhas de categorias personalizadas (parentCategory null) — os insights
    // de "estourou o orçamento" abaixo são só pras 7 categorias padrão por enquanto.
    const parentBudgets = budgets.filter(
      (b): b is typeof b & { parentCategory: NonNullable<typeof b.parentCategory> } => b.parentCategory !== null,
    );
    for (const budget of parentBudgets) {
      const planned = Number(budget.plannedAmount);
      if (planned <= 0) continue;
      const spent = spentMap.get(budget.parentCategory) ?? 0;
      const percent = spent / planned;
      const label = PARENT_CATEGORY_LABEL[budget.parentCategory];
      if (percent > 1) {
        const over = formatBRL(spent - planned);
        insights.push({
          id: `budget-${budget.parentCategory}`,
          message: `${label} estourou o orçamento em ${formatPercent(percent - 1)} este mês (${over} acima do planejado) — vale segurar novos gastos nessa categoria ou revisar o valor planejado.`,
          tone: "danger",
          category: "fluxo",
          href: monthlyEntryHref,
          actionLabel: "Ver lançamentos do mês",
        });
      } else if (percent >= 0.8) {
        insights.push({
          id: `budget-${budget.parentCategory}`,
          message: `Você já comprometeu ${formatPercent(percent)} do orçamento de ${label} este mês — ainda dá para segurar o resto do mês.`,
          tone: "warning",
          category: "fluxo",
          href: monthlyEntryHref,
          actionLabel: "Ver lançamentos do mês",
        });
      }
    }
  }

  if (spentByCategory.length > 0) {
    const biggest = spentByCategory.reduce((max, s) => (s.spent > max.spent ? s : max));
    if (biggest.spent > 0) {
      insights.push({
        id: "biggest-expense-category",
        message: `${PARENT_CATEGORY_LABEL[biggest.parentCategory]} segue sendo onde mais sai dinheiro este mês (${formatBRL(biggest.spent)}).`,
        tone: "info",
        category: "fluxo",
        href: monthlyEntryHref,
        actionLabel: "Ver lançamentos do mês",
      });
    }
  }

  const trailingMonthOffsets = Array.from({ length: TRAILING_MONTHS_FOR_AVERAGE }, (_, i) => i + 1);
  const trailingSummaries = await Promise.all(
    trailingMonthOffsets.map((i) => {
      const pastDate = new Date(year, month - 1 - i, 1);
      return getMonthlySummary(ctx, pastDate.getFullYear(), pastDate.getMonth() + 1);
    }),
  );
  const trailingRates = trailingSummaries
    .filter((s) => s.totalIncome > 0)
    .map((s) => (s.totalIncome - s.totalExpense) / s.totalIncome);
  if (trailingRates.length >= 3 && currentMonthSummary.totalIncome > 0) {
    const averageRate = trailingRates.reduce((sum, r) => sum + r, 0) / trailingRates.length;
    const currentRate = (currentMonthSummary.totalIncome - currentMonthSummary.totalExpense) / currentMonthSummary.totalIncome;
    const diff = currentRate - averageRate;
    if (diff > 0.05) {
      insights.push({
        id: "savings-rate-above-average",
        message: `Você está poupando acima da sua média este mês (${formatPercent(currentRate)} vs. média de ${formatPercent(averageRate)}) — é um bom momento para reforçar uma meta ou a reserva de emergência.`,
        tone: "success",
        category: "fluxo",
      });
    } else if (diff < -0.05) {
      insights.push({
        id: "savings-rate-below-average",
        message: `Você está poupando abaixo da sua média este mês (${formatPercent(currentRate)} vs. média de ${formatPercent(averageRate)}) — vale revisar os gastos para não atrasar suas metas.`,
        tone: "warning",
        category: "fluxo",
        href: monthlyEntryHref,
        actionLabel: "Ver lançamentos do mês",
      });
    }
  }

  // --- Planejado x Realizado ---

  const comparativoHref = `/orcamento/${year}`;

  if (notifyBudget) {
    const currentMonthComparison = annualBudgetComparison.months.find((m) => m.month === month);
    if (currentMonthComparison) {
      for (const cat of currentMonthComparison.categories) {
        if (cat.deviationPercent !== null && cat.deviationPercent <= -0.15) {
          insights.push({
            id: `budget-saving-${cat.categoryKey}`,
            message: `Você está economizando mais do que planejou em ${categoryLabel(cat.categoryKey)} este mês.`,
            tone: "success",
            category: "fluxo",
            href: comparativoHref,
            actionLabel: "Ver comparativo",
          });
        }
      }
    }

    const realizedMonths = annualBudgetComparison.months.filter((m) => m.isRealized);
    if (realizedMonths.length > 0 && annualBudgetComparison.totalPlannedRealized > 0) {
      const accumulatedSavings = annualBudgetComparison.totalPlannedRealized - annualBudgetComparison.totalSpentRealized;
      const averageMonthlySavings = accumulatedSavings / realizedMonths.length;
      const remainingMonths = 12 - realizedMonths.length;
      const projectedAnnualSavings = accumulatedSavings + averageMonthlySavings * remainingMonths;
      if (projectedAnnualSavings > 0) {
        insights.push({
          id: "budget-projected-annual-savings",
          message: `Se continuar nesse ritmo, você vai economizar aproximadamente ${formatBRL(projectedAnnualSavings)} neste ano.`,
          tone: "success",
          category: "fluxo",
          href: comparativoHref,
          actionLabel: "Ver comparativo",
        });
      }
    }

    const monthsDescending = [...realizedMonths].sort((a, b) => b.month - a.month);
    for (const categoryKey of allCategoryKeys) {
      const streak = computeOverBudgetStreak(monthsDescending, categoryKey);
      if (streak >= 3) {
        insights.push({
          id: `budget-streak-${categoryKey}`,
          message: `Você está excedendo o orçamento de ${categoryLabel(categoryKey)} há ${streak} meses consecutivos.`,
          tone: "danger",
          category: "fluxo",
          href: comparativoHref,
          actionLabel: "Ver comparativo",
        });
      }
    }
  }

  // --- Reserva de Emergência ---

  if (emergencyFund) {
    const target = Number(emergencyFund.targetAmount);
    const current = Number(emergencyFund.currentAmount);
    const percent = target > 0 ? current / target : 0;
    const reserveHref = "/planejamento/reserva-emergencia";
    if (percent >= 1) {
      insights.push({
        id: "emergency-fund",
        message: `Sua reserva de emergência está completa (${formatBRL(current)}) — você tem proteção garantida para imprevistos.`,
        tone: "success",
        category: "reserva",
      });
    } else if (percent >= 0.5) {
      insights.push({
        id: "emergency-fund",
        message: `Sua reserva de emergência está ${formatPercent(percent)} completa (${formatBRL(current)} de ${formatBRL(target)}) — continue aportando até cobrir o valor-alvo.`,
        tone: "warning",
        category: "reserva",
        href: reserveHref,
        actionLabel: "Ver reserva de emergência",
      });
    } else {
      insights.push({
        id: "emergency-fund",
        message: `Sua reserva de emergência cobre só ${formatPercent(percent)} do valor-alvo — priorize esse aporte antes de outros objetivos, para não precisar recorrer a dívida em um imprevisto.`,
        tone: "danger",
        category: "reserva",
        href: reserveHref,
        actionLabel: "Ver reserva de emergência",
      });
    }
  }

  // --- Metas ---

  const goalPlans = goals.map((goal) => ({
    goal,
    plan: computeGoalPlan({
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate ?? now,
      annualRate: Number(goal.annualRate ?? 0),
    }),
  }));

  const goalsHref = "/planejamento/metas";

  if (notifyGoals) {
    const behindGoals = goalPlans.filter(({ plan }) => plan.status === "BEHIND");
    if (behindGoals.length > 0) {
      insights.push({
        id: "goals-behind",
        message: `${behindGoals.length} meta${behindGoals.length > 1 ? "s está" : " está"} atrasada${behindGoals.length > 1 ? "s" : ""} (${behindGoals.map(({ goal }) => goal.name).join(", ")}) — revise o prazo ou aumente o aporte mensal para voltar ao ritmo.`,
        tone: "danger",
        category: "metas",
        href: goalsHref,
        actionLabel: "Ver metas",
      });
    }
  }

  const onTrackGoals = goalPlans
    .filter(({ plan }) => plan.status === "ON_TRACK")
    .sort((a, b) => a.plan.monthsRemaining - b.plan.monthsRemaining);

  if (onTrackGoals.length > 0) {
    const { goal, plan } = onTrackGoals[0];
    const dateLabel = formatMonthYear(goal.targetDate ?? now);
    insights.push({
      id: `goal-completion-${goal.id}`,
      message: `Se você continuar nesse ritmo, a meta "${goal.name}" será conquistada em ${dateLabel}.`,
      tone: "success",
      category: "metas",
      href: `/planejamento/metas/${goal.id}`,
      actionLabel: "Ver meta",
    });

    // Simulação "e se": aumentar o aporte em ~20% (arredondado) e ver quanto tempo se ganha.
    const monthlyRate = plan.monthlyRate;
    const extra = Math.max(50, Math.round((plan.requiredMonthlyContribution * 0.2) / 50) * 50);
    const boostedContribution = plan.requiredMonthlyContribution + extra;
    const monthsWithBoost = nper(
      monthlyRate,
      boostedContribution,
      Number(goal.currentAmount),
      Number(goal.targetAmount),
      1,
    ).toNumber();
    const monthsSaved = Math.round(plan.monthsRemaining - monthsWithBoost);
    if (monthsSaved >= 1 && Number.isFinite(monthsWithBoost)) {
      insights.push({
        id: `goal-what-if-${goal.id}`,
        message: `Aumentando o aporte de "${goal.name}" em ${formatBRL(extra)}/mês, você antecipa a conquista em ${monthsSaved} mês${monthsSaved > 1 ? "es" : ""}.`,
        tone: "info",
        category: "metas",
        href: `/planejamento/metas/${goal.id}`,
        actionLabel: "Ver meta",
      });
    }
  }

  // --- Carteira ---

  const strategyHref = "/carteira/por-objetivo";

  for (const position of strategyComparison.positions) {
    if (position.targetPercent <= 0 || position.status === "DENTRO") continue;
    const label = STRATEGY_ASSET_CLASS_LABEL[position.assetClass];
    const pp = formatPercentNumber(Math.abs(position.deviationPercent * 100), 1).replace("%", "");
    const direction = position.status === "ACIMA" ? "acima" : "abaixo";
    const consequence =
      position.status === "ACIMA"
        ? "isso concentra mais risco do que sua estratégia definida."
        : "isso deixa sua carteira menos exposta a essa classe do que o planejado.";
    insights.push({
      id: `strategy-${position.assetClass}`,
      message: `Sua carteira está ${pp} p.p. ${direction} do alvo em ${label} — ${consequence}`,
      tone: "warning",
      category: "carteira",
      href: strategyHref,
      actionLabel: "Ver rebalanceamento",
    });
  }

  if (portfolio.totalPortfolio > 0) {
    await recordPatrimonySnapshotIfNeeded(ctx, portfolio.totalPortfolio);

    const twelveMonthsAgo = await getPatrimonySnapshotMonthsAgo(ctx, 12);
    if (twelveMonthsAgo !== null && twelveMonthsAgo > 0) {
      const growth = (portfolio.totalPortfolio - twelveMonthsAgo) / twelveMonthsAgo;
      insights.push({
        id: "patrimony-growth-12m",
        message:
          growth >= 0
            ? `Seu patrimônio cresceu ${formatPercent(growth)} nos últimos 12 meses — você está construindo patrimônio de verdade.`
            : `Seu patrimônio caiu ${formatPercent(Math.abs(growth))} nos últimos 12 meses — vale entender se foi desvalorização de mercado ou saques.`,
        tone: growth >= 0 ? "success" : "warning",
        category: "carteira",
        href: "/carteira",
        actionLabel: "Ver patrimônio",
      });
    }

    const previousHigh = await getPatrimonyAllTimeHighBeforeToday(ctx);
    if (previousHigh !== null && portfolio.totalPortfolio > previousHigh) {
      insights.push({
        id: "patrimony-new-high",
        message: `Seu patrimônio bateu um novo recorde hoje: ${formatBRL(portfolio.totalPortfolio)}.`,
        tone: "success",
        category: "carteira",
        href: "/carteira",
        actionLabel: "Ver patrimônio",
      });
    }
  }

  return sortByPriority(insights);
}

export type ExecutiveSummary = { message: string; tone: InsightTone };

/**
 * Resumo de 1-2 frases a partir dos insights já gerados — pura composição de regras sobre
 * as contagens por tom, sem nenhum cálculo financeiro novo. Objetivo: qualquer pessoa
 * entender sua situação financeira em poucos segundos, sem precisar ler cada card.
 */
export function computeExecutiveSummary(insights: Insight[]): ExecutiveSummary {
  if (insights.length === 0) {
    return {
      message:
        "Ainda não há dados suficientes para um resumo completo. Cadastre seu orçamento, metas, reserva de emergência e uma estratégia de carteira para começar.",
      tone: "info",
    };
  }

  const dangerCount = insights.filter((i) => i.tone === "danger").length;
  const warningCount = insights.filter((i) => i.tone === "warning").length;
  const successCount = insights.filter((i) => i.tone === "success").length;

  if (dangerCount > 0) {
    return {
      message: `Seu planejamento financeiro pede atenção: ${dangerCount} ponto${dangerCount > 1 ? "s" : ""} pode${dangerCount > 1 ? "m" : ""} comprometer seus objetivos se não forem ajustados este mês.`,
      tone: "danger",
    };
  }

  if (warningCount > successCount) {
    return {
      message: "Seu planejamento está no caminho certo, mas alguns pontos merecem atenção nas próximas semanas.",
      tone: "warning",
    };
  }

  if (successCount > 0) {
    return {
      message: "Seu planejamento financeiro está saudável. Você está no caminho para atingir seus principais objetivos.",
      tone: "success",
    };
  }

  return {
    message: "Seus números estão estáveis por enquanto, sem pontos de atenção nem destaques este mês.",
    tone: "info",
  };
}
