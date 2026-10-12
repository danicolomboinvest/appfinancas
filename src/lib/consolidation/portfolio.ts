import type { AssetClass } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type ClassAllocation = {
  assetClass: AssetClass;
  currentValue: number;
  currentPercent: number;
};

/**
 * Alocação atual por classe de ativo: soma o valor atual de cada classe.
 *
 * Já teve uma série "ideal", somada do `idealAllocationPercent` de cada ativo. Esse campo saiu
 * do formulário quando a Estratégia da Carteira virou a alocação ideal única, e ninguém mais o
 * preenche: o gráfico mostrava "ideal 0%" em tudo logo abaixo da seção que diz "deveria ter
 * 40%". O ideal mora na Estratégia (getPortfolioStrategyComparison); aqui fica só o retrato.
 */
export async function getAllocationByClass(ctx: AuthContext): Promise<{ classes: ClassAllocation[]; totalPortfolio: number }> {
  const assets = await prisma.asset.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId } });
  const totalPortfolio = assets.reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));

  const byClass = new Map<AssetClass, Decimal>();
  for (const asset of assets) {
    byClass.set(asset.assetClass, (byClass.get(asset.assetClass) ?? new Decimal(0)).plus(asset.currentValue));
  }

  const classes: ClassAllocation[] = Array.from(byClass.entries()).map(([assetClass, currentValue]) => ({
    assetClass,
    currentValue: currentValue.toNumber(),
    currentPercent: totalPortfolio.greaterThan(0) ? currentValue.div(totalPortfolio).toNumber() : 0,
  }));

  return { classes, totalPortfolio: totalPortfolio.toNumber() };
}
