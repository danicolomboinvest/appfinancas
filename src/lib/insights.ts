import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { sumExpensesByParentCategory, listBudgets } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { computeGoalPlan } from "@/lib/planning/goal";
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
export type Insight = { id: string; message: string; tone: InsightTone; category: InsightCategory };

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
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId } }),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    prisma.goal.findMany({ where: { userId: ctx.userId } }),
    prisma.emergencyFund.findUnique({ where: { userId: ctx.userId } }),
    getPortfolioStrategyComparison(ctx),
    getPortfolioByObjective(ctx),
    getMonthlySummary(ctx, year, month),
  ]);

  const insights: Insight[] = [];
  const notifyBudget = user?.notifyBudgetAlerts ?? true;
  const notifyGoals = user?.notifyLateGoals ?? true;

  // --- Fluxo Financeiro ---

  if (notifyBudget) {
    const spentMap = new Map(spentByCategory.map((s) => [s.parentCategory, s.spent]));
    for (const budget of budgets) {
      const planned = Number(budget.plannedAmount);
      if (planned <= 0) continue;
      const spent = spentMap.get(budget.parentCategory) ?? 0;
      const percent = spent / planned;
      const label = PARENT_CATEGORY_LABEL[budget.parentCategory];
      if (percent > 1) {
        insights.push({
          id: `budget-${budget.parentCategory}`,
          message: `Você gastou ${formatPercent(percent - 1)} acima do planejado em ${label} este mês.`,
          tone: "danger",
          category: "fluxo",
        });
      } else if (percent >= 0.8) {
        insights.push({
          id: `budget-${budget.parentCategory}`,
          message: `Você já usou ${formatPercent(percent)} do orçamento de ${label} este mês.`,
          tone: "warning",
          category: "fluxo",
        });
      }
    }
  }

  if (spentByCategory.length > 0) {
    const biggest = spentByCategory.reduce((max, s) => (s.spent > max.spent ? s : max));
    if (biggest.spent > 0) {
      insights.push({
        id: "biggest-expense-category",
        message: `Seu maior gasto este mês continua sendo ${PARENT_CATEGORY_LABEL[biggest.parentCategory]}.`,
        tone: "info",
        category: "fluxo",
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
        message: `Você está economizando acima da sua média este mês (${formatPercent(currentRate)} vs. média de ${formatPercent(averageRate)}).`,
        tone: "success",
        category: "fluxo",
      });
    } else if (diff < -0.05) {
      insights.push({
        id: "savings-rate-below-average",
        message: `Você está economizando abaixo da sua média este mês (${formatPercent(currentRate)} vs. média de ${formatPercent(averageRate)}).`,
        tone: "warning",
        category: "fluxo",
      });
    }
  }

  // --- Reserva de Emergência ---

  if (emergencyFund) {
    const target = Number(emergencyFund.targetAmount);
    const current = Number(emergencyFund.currentAmount);
    const percent = target > 0 ? current / target : 0;
    insights.push({
      id: "emergency-fund",
      message: `Sua reserva de emergência está ${formatPercent(percent)} completa.`,
      tone: percent >= 1 ? "success" : percent >= 0.5 ? "warning" : "danger",
      category: "reserva",
    });
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

  if (notifyGoals) {
    const behindGoals = goalPlans.filter(({ plan }) => plan.status === "BEHIND");
    if (behindGoals.length > 0) {
      insights.push({
        id: "goals-behind",
        message: `Você tem ${behindGoals.length} meta${behindGoals.length > 1 ? "s" : ""} atrasada${behindGoals.length > 1 ? "s" : ""}: ${behindGoals.map(({ goal }) => goal.name).join(", ")}.`,
        tone: "danger",
        category: "metas",
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
      message: `Sua meta "${goal.name}" será conquistada em ${dateLabel}, nesse ritmo.`,
      tone: "info",
      category: "metas",
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
        message: `Aumentando o aporte de "${goal.name}" em ${formatBRL(extra)}/mês, você chegaria lá ${monthsSaved} mês${monthsSaved > 1 ? "es" : ""} mais cedo.`,
        tone: "info",
        category: "metas",
      });
    }
  }

  // --- Carteira ---

  for (const position of strategyComparison.positions) {
    if (position.targetPercent <= 0 || position.status === "DENTRO") continue;
    const label = STRATEGY_ASSET_CLASS_LABEL[position.assetClass];
    const pp = formatPercentNumber(Math.abs(position.deviationPercent * 100), 1).replace("%", "");
    insights.push({
      id: `strategy-${position.assetClass}`,
      message: `Sua carteira está ${pp} p.p. ${position.status === "ACIMA" ? "acima" : "abaixo"} do alvo em ${label}.`,
      tone: "warning",
      category: "carteira",
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
            ? `Seu patrimônio cresceu ${formatPercent(growth)} nos últimos 12 meses.`
            : `Seu patrimônio caiu ${formatPercent(Math.abs(growth))} nos últimos 12 meses.`,
        tone: growth >= 0 ? "success" : "warning",
        category: "carteira",
      });
    }

    const previousHigh = await getPatrimonyAllTimeHighBeforeToday(ctx);
    if (previousHigh !== null && portfolio.totalPortfolio > previousHigh) {
      insights.push({
        id: "patrimony-new-high",
        message: "Seu patrimônio bateu um novo recorde hoje.",
        tone: "success",
        category: "carteira",
      });
    }
  }

  return insights;
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
