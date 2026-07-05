import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { sumExpensesByParentCategory, listBudgets } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { computeGoalPlan } from "@/lib/planning/goal";
import { getPortfolioStrategyComparison, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";

export type InsightTone = "success" | "warning" | "danger";
export type Insight = { id: string; message: string; tone: InsightTone };

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Gera cards de insight automáticos a partir de Fluxo Financeiro (orçamento), Metas, Carteira
 * (estratégia) e Reserva de Emergência. Respeita as preferências de notificação do usuário
 * (orçamento estourado / metas atrasadas) definidas em Configurações.
 */
export async function computeInsights(ctx: AuthContext): Promise<Insight[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [user, budgets, spentByCategory, goals, emergencyFund, strategyComparison] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId } }),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    prisma.goal.findMany({ where: { userId: ctx.userId } }),
    prisma.emergencyFund.findUnique({ where: { userId: ctx.userId } }),
    getPortfolioStrategyComparison(ctx),
  ]);

  const insights: Insight[] = [];
  const notifyBudget = user?.notifyBudgetAlerts ?? true;
  const notifyGoals = user?.notifyLateGoals ?? true;

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
        });
      } else if (percent >= 0.8) {
        insights.push({
          id: `budget-${budget.parentCategory}`,
          message: `Você já usou ${formatPercent(percent)} do orçamento de ${label} este mês.`,
          tone: "warning",
        });
      }
    }
  }

  if (emergencyFund) {
    const target = Number(emergencyFund.targetAmount);
    const current = Number(emergencyFund.currentAmount);
    const percent = target > 0 ? current / target : 0;
    insights.push({
      id: "emergency-fund",
      message: `Sua reserva de emergência está ${formatPercent(percent)} completa.`,
      tone: percent >= 1 ? "success" : percent >= 0.5 ? "warning" : "danger",
    });
  }

  if (notifyGoals) {
    const now2 = new Date();
    const behindGoals = goals.filter((goal) => {
      const plan = computeGoalPlan({
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        targetDate: goal.targetDate ?? now2,
        annualRate: Number(goal.annualRate ?? 0),
      });
      return plan.status === "BEHIND";
    });
    if (behindGoals.length > 0) {
      insights.push({
        id: "goals-behind",
        message: `Você tem ${behindGoals.length} meta${behindGoals.length > 1 ? "s" : ""} atrasada${behindGoals.length > 1 ? "s" : ""}: ${behindGoals.map((g) => g.name).join(", ")}.`,
        tone: "danger",
      });
    }
  }

  for (const position of strategyComparison.positions) {
    if (position.targetPercent <= 0 || position.status === "DENTRO") continue;
    const label = STRATEGY_ASSET_CLASS_LABEL[position.assetClass];
    const pp = Math.abs(position.deviationPercent * 100).toFixed(1);
    insights.push({
      id: `strategy-${position.assetClass}`,
      message: `Sua carteira está ${pp} p.p. ${position.status === "ACIMA" ? "acima" : "abaixo"} do alvo em ${label}.`,
      tone: "warning",
    });
  }

  return insights;
}
