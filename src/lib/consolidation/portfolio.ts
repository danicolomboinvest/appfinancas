import type { AssetClass } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type GoalAllocation = {
  goalId: string;
  goalName: string;
  currentValue: number;
  targetAmount: number;
  achievementPercent: number;
};

export type PortfolioByObjective = {
  totalPortfolio: number;
  reserva: { currentValue: number; targetAmount: number | null; achievementPercent: number | null };
  liberdade: { currentValue: number };
  metas: GoalAllocation[];
  outro: { currentValue: number };
};

/**
 * Consolidação "posição atual por objetivo" (equivalente ao SUMIF da planilha original):
 * soma o valor dos ativos marcados com cada objetivo e compara com a meta correspondente.
 */
export async function getPortfolioByObjective(ctx: AuthContext): Promise<PortfolioByObjective> {
  const [assets, emergencyFund, goals] = await Promise.all([
    prisma.asset.findMany({ where: { userId: ctx.userId } }),
    prisma.emergencyFund.findUnique({ where: { userId: ctx.userId } }),
    prisma.goal.findMany({ where: { userId: ctx.userId } }),
  ]);

  const sumByObjective = (objective: "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "OUTRO") =>
    assets
      .filter((asset) => asset.objective === objective)
      .reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));

  const reservaValue = sumByObjective("RESERVA_EMERGENCIA");
  const liberdadeValue = sumByObjective("LIBERDADE_FINANCEIRA");
  const outroValue = sumByObjective("OUTRO");

  const metaAssets = assets.filter((asset) => asset.objective === "META" && asset.goalId);
  const metas: GoalAllocation[] = goals.map((goal) => {
    const currentValue = metaAssets
      .filter((asset) => asset.goalId === goal.id)
      .reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));
    const targetAmount = new Decimal(goal.targetAmount);
    return {
      goalId: goal.id,
      goalName: goal.name,
      currentValue: currentValue.toNumber(),
      targetAmount: targetAmount.toNumber(),
      achievementPercent: targetAmount.greaterThan(0) ? currentValue.div(targetAmount).toNumber() : 0,
    };
  });

  const totalPortfolio = assets.reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));
  const emergencyTarget = emergencyFund ? new Decimal(emergencyFund.targetAmount) : null;

  return {
    totalPortfolio: totalPortfolio.toNumber(),
    reserva: {
      currentValue: reservaValue.toNumber(),
      targetAmount: emergencyTarget?.toNumber() ?? null,
      achievementPercent: emergencyTarget && emergencyTarget.greaterThan(0) ? reservaValue.div(emergencyTarget).toNumber() : null,
    },
    liberdade: { currentValue: liberdadeValue.toNumber() },
    metas,
    outro: { currentValue: outroValue.toNumber() },
  };
}

export type ClassAllocation = {
  assetClass: AssetClass;
  currentValue: number;
  currentPercent: number;
  idealPercent: number;
};

/**
 * Alocação atual vs ideal por classe de ativo: soma o valor atual de cada classe e compara
 * com a soma dos "idealAllocationPercent" declarados por ativo, base para rebalanceamento.
 */
export async function getAllocationByClass(ctx: AuthContext): Promise<{ classes: ClassAllocation[]; totalPortfolio: number }> {
  const assets = await prisma.asset.findMany({ where: { userId: ctx.userId } });
  const totalPortfolio = assets.reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));

  const byClass = new Map<AssetClass, { currentValue: Decimal; idealPercent: Decimal }>();
  for (const asset of assets) {
    const entry = byClass.get(asset.assetClass) ?? { currentValue: new Decimal(0), idealPercent: new Decimal(0) };
    entry.currentValue = entry.currentValue.plus(asset.currentValue);
    entry.idealPercent = entry.idealPercent.plus(asset.idealAllocationPercent ?? 0);
    byClass.set(asset.assetClass, entry);
  }

  const classes: ClassAllocation[] = Array.from(byClass.entries()).map(([assetClass, v]) => ({
    assetClass,
    currentValue: v.currentValue.toNumber(),
    currentPercent: totalPortfolio.greaterThan(0) ? v.currentValue.div(totalPortfolio).toNumber() : 0,
    idealPercent: v.idealPercent.toNumber(),
  }));

  return { classes, totalPortfolio: totalPortfolio.toNumber() };
}
