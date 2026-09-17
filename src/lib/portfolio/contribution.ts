import type { StrategyAssetClass } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getPortfolioStrategyComparison, mapAssetToStrategyClass, STRATEGY_ASSET_CLASS_LABEL } from "./strategy";
import type { ClassGap } from "./contribution-plan";

export type ContributionDestination = { assetId: string; assetName: string };

export type ContributionContext = {
  hasStrategy: boolean;
  /** Aporte planejado pro mês (do orçamento); 0 quando não há plano. */
  plannedAmount: number;
  classes: ClassGap[];
  /** Pra cada classe, o ativo que recebe o dinheiro (o maior dela). Classe sem ativo = null. */
  destinations: Record<string, ContributionDestination | null>;
  labels: Record<string, string>;
};

/**
 * Tudo que o card "onde colocar o aporte deste mês" precisa: estratégia, carteira por classe
 * e o ativo de destino em cada classe. A conta em si (planContribution) é pura e roda no
 * cliente, porque a pessoa pode mudar o valor do aporte e ver a divisão mudar na hora.
 */
export async function getContributionContext(ctx: AuthContext, year: number, month: number): Promise<ContributionContext> {
  const [comparison, plan, assets] = await Promise.all([
    getPortfolioStrategyComparison(ctx),
    getMonthlyPlan(ctx, year, month),
    prisma.asset.findMany({ where: { userId: ctx.userId }, select: { id: true, name: true, ticker: true, assetClass: true, fixedIncomeIndex: true, currentValue: true } }),
  ]);

  const destinations: Record<string, ContributionDestination | null> = {};
  for (const p of comparison.positions) {
    const inClass = assets.filter((a) => mapAssetToStrategyClass(a) === p.assetClass);
    const biggest = inClass.sort((a, b) => Number(b.currentValue) - Number(a.currentValue))[0];
    destinations[p.assetClass] = biggest ? { assetId: biggest.id, assetName: biggest.ticker && biggest.ticker !== biggest.name ? `${biggest.name} (${biggest.ticker})` : biggest.name } : null;
  }

  return {
    hasStrategy: comparison.positions.some((p) => p.targetPercent > 0),
    plannedAmount: plan?.plannedInvestment ?? 0,
    classes: comparison.positions.map((p) => ({ assetClass: p.assetClass, currentValue: p.currentValue, targetPercent: p.targetPercent })),
    destinations,
    labels: Object.fromEntries(comparison.positions.map((p) => [p.assetClass, STRATEGY_ASSET_CLASS_LABEL[p.assetClass as StrategyAssetClass]])),
  };
}
