import type { AssetClass } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";

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
    prisma.asset.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId } }),
    prisma.emergencyFund.findUnique({ where: { userId: ctx.userId, profileId: ctx.profileId } }),
    // Mesma conta da tela de Metas e do Dashboard (ativos da meta + aportes que ainda não
    // entraram num ativo dela + o "já guardado" digitado). Somar só os ativos aqui fazia a
    // mesma meta mostrar R$ 3.000 / 30% lá e R$ 0 / 0% no "Por objetivo".
    listGoalsWithProgress(ctx),
  ]);

  const goalIds = new Set(goals.map((g) => g.id));
  const sumByObjective = (objective: "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "OUTRO") =>
    assets
      .filter((asset) => objectiveBucket(asset, goalIds) === objective)
      .reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));

  const reservaValue = sumByObjective("RESERVA_EMERGENCIA");
  const liberdadeValue = sumByObjective("LIBERDADE_FINANCEIRA");
  const outroValue = sumByObjective("OUTRO");

  const metas: GoalAllocation[] = goals.map((goal) => {
    const currentValue = new Decimal(goal.computedCurrentAmount);
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

/**
 * Em qual card do "Por objetivo" o ativo entra. Ativo marcado "Meta" sem meta (salvo com
 * "Selecione", ou cuja meta foi apagada — a FK zera o goalId e deixa o objetivo) não entrava
 * em card nenhum: R$ 20.000 sumiam da tela, e os cards não somavam o total da carteira. Ele
 * conta como "sem objetivo", que é o que ele é agora.
 */
export function objectiveBucket(
  asset: { objective: string; goalId: string | null },
  goalIds: ReadonlySet<string>,
): "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "META" | "OUTRO" {
  if (asset.objective === "RESERVA_EMERGENCIA" || asset.objective === "LIBERDADE_FINANCEIRA") return asset.objective;
  if (asset.objective === "META" && asset.goalId && goalIds.has(asset.goalId)) return "META";
  return "OUTRO";
}

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
