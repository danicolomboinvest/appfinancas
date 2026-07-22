import type { AssetClass, FixedIncomeIndex, StrategyAssetClass } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export const STRATEGY_ASSET_CLASSES: StrategyAssetClass[] = [
  "RENDA_FIXA_POS_FIXADA",
  "RENDA_FIXA_IPCA",
  "PREFIXADO",
  "ACOES_BRASIL",
  "FIIS",
  "EXTERIOR",
  "OUTROS",
];

/** Cor FIXA por categoria de estratégia, a mesma em todos os gráficos (Carteira Atual,
 * Estratégia-alvo, rebalanceamento), pra comparação bater à vista (item 10). */
export const STRATEGY_ASSET_CLASS_COLOR: Record<StrategyAssetClass, string> = {
  RENDA_FIXA_POS_FIXADA: "#4FA3C7",
  RENDA_FIXA_IPCA: "#5FB88A",
  PREFIXADO: "#A78BC0",
  ACOES_BRASIL: "#E0A85F",
  FIIS: "#6D8BD0",
  EXTERIOR: "#D98C6A",
  OUTROS: "#9AA0A6",
};

export const STRATEGY_ASSET_CLASS_LABEL: Record<StrategyAssetClass, string> = {
  RENDA_FIXA_POS_FIXADA: "Renda Fixa pós-fixada",
  RENDA_FIXA_IPCA: "Renda Fixa IPCA+",
  PREFIXADO: "Prefixado",
  ACOES_BRASIL: "Ações Brasil",
  FIIS: "FIIs",
  EXTERIOR: "Exterior",
  OUTROS: "Outros",
};

/**
 * Mapeamento padrão de AssetClass (cadastro de ativo individual) para StrategyAssetClass
 * (taxonomia da Estratégia da Carteira, mais granular para renda fixa). É uma aproximação:
 * como o cadastro de ativos não distingue pós-fixado/IPCA+/prefixado dentro de RENDA_FIXA,
 * assumimos pós-fixado por padrão, o objetivo aqui é o desvio matemático agregado, não uma
 * classificação individual precisa por ativo.
 */
const DEFAULT_MAPPING: Record<AssetClass, StrategyAssetClass> = {
  RENDA_FIXA: "RENDA_FIXA_POS_FIXADA",
  TESOURO_DIRETO: "RENDA_FIXA_POS_FIXADA",
  ACAO: "ACOES_BRASIL",
  FII: "FIIS",
  FUNDO: "OUTROS",
  CRIPTO: "OUTROS",
  OUTRO: "OUTROS",
};

export function mapAssetClassToStrategyClass(assetClass: AssetClass): StrategyAssetClass {
  return DEFAULT_MAPPING[assetClass];
}

/**
 * Mapeamento refinado por ATIVO: para renda fixa/Tesouro, usa o indexador do título
 * (pós-fixado, IPCA+ ou prefixado) quando conhecido, assim o comparativo com a Estratégia
 * fica correto (antes assumia tudo pós-fixado). Para o resto, cai no mapa por classe.
 */
export function mapAssetToStrategyClass(asset: {
  assetClass: AssetClass;
  fixedIncomeIndex: FixedIncomeIndex | null;
}): StrategyAssetClass {
  if (asset.assetClass === "RENDA_FIXA" || asset.assetClass === "TESOURO_DIRETO") {
    if (asset.fixedIncomeIndex === "IPCA") return "RENDA_FIXA_IPCA";
    if (asset.fixedIncomeIndex === "PREFIXADO") return "PREFIXADO";
    return "RENDA_FIXA_POS_FIXADA"; // POS_FIXADO ou desconhecido → pós-fixado (default seguro)
  }
  return DEFAULT_MAPPING[asset.assetClass];
}

export type StrategyClassPosition = {
  assetClass: StrategyAssetClass;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  /** currentPercent - targetPercent, em pontos percentuais. Positivo = acima do alvo. */
  deviationPercent: number;
  /** Valor em R$ a comprar (positivo) ou vender (negativo) para bater o alvo. */
  rebalanceAmount: number;
  status: "ACIMA" | "DENTRO" | "ABAIXO";
};

const TOLERANCE_PP = 0.02; // 2 pontos percentuais de tolerância antes de considerar "fora do alvo"

export async function getPortfolioStrategyComparison(ctx: AuthContext): Promise<{
  positions: StrategyClassPosition[];
  totalPortfolio: number;
}> {
  const [assets, strategyRows] = await Promise.all([
    prisma.asset.findMany({ where: { userId: ctx.userId } }),
    prisma.portfolioStrategy.findMany({ where: { userId: ctx.userId } }),
  ]);

  const totalPortfolio = assets.reduce((sum, asset) => sum.plus(asset.currentValue), new Decimal(0));

  const currentByClass = new Map<StrategyAssetClass, Decimal>();
  for (const asset of assets) {
    const strategyClass = mapAssetToStrategyClass(asset);
    currentByClass.set(strategyClass, (currentByClass.get(strategyClass) ?? new Decimal(0)).plus(asset.currentValue));
  }

  const targetByClass = new Map<StrategyAssetClass, Decimal>(
    strategyRows.map((row) => [row.assetClass, new Decimal(row.targetPercent)]),
  );

  const positions: StrategyClassPosition[] = STRATEGY_ASSET_CLASSES.map((assetClass) => {
    const currentValue = currentByClass.get(assetClass) ?? new Decimal(0);
    const currentPercent = totalPortfolio.greaterThan(0) ? currentValue.div(totalPortfolio).toNumber() : 0;
    const targetPercent = (targetByClass.get(assetClass) ?? new Decimal(0)).toNumber();
    const deviationPercent = currentPercent - targetPercent;
    const targetValue = totalPortfolio.times(targetPercent);
    const rebalanceAmount = targetValue.minus(currentValue).toNumber();
    const status: StrategyClassPosition["status"] =
      deviationPercent > TOLERANCE_PP ? "ACIMA" : deviationPercent < -TOLERANCE_PP ? "ABAIXO" : "DENTRO";

    return {
      assetClass,
      currentValue: currentValue.toNumber(),
      currentPercent,
      targetPercent,
      deviationPercent,
      rebalanceAmount,
      status,
    };
  });

  return { positions, totalPortfolio: totalPortfolio.toNumber() };
}
