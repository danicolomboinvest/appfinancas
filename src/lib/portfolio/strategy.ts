import type { AssetClass, StrategyAssetClass } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { classeDaEstrategia, type AtivoParaClassificar } from "./classificacao";

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
  // Variáveis, não hex: os valores moram no globals.css e um tema pode trocar (o Girly pinta
  // tudo de rosa). O SVG e o `style` resolvem var() como qualquer propriedade.
  RENDA_FIXA_POS_FIXADA: "var(--color-strat-pos)",
  RENDA_FIXA_IPCA: "var(--color-strat-ipca)",
  PREFIXADO: "var(--color-strat-pre)",
  ACOES_BRASIL: "var(--color-strat-acoes)",
  FIIS: "var(--color-strat-fiis)",
  EXTERIOR: "var(--color-strat-exterior)",
  OUTROS: "var(--color-strat-outros)",
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
  INTERNACIONAL: "EXTERIOR",
  OUTRO: "OUTROS",
};

export function mapAssetClassToStrategyClass(assetClass: AssetClass): StrategyAssetClass {
  return DEFAULT_MAPPING[assetClass];
}

/**
 * Mapeamento por ATIVO: renda fixa/Tesouro pelo indexador (pós, IPCA+ ou prefixado), o que está
 * fora do Brasil no Exterior, e a classificação que ELA escolheu no detalhe do ativo mandando
 * sobre tudo (ver lib/portfolio/classificacao.ts).
 */
export function mapAssetToStrategyClass(asset: AtivoParaClassificar): StrategyAssetClass {
  return classeDaEstrategia(asset);
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

const TOLERANCE_PP = 0.02;
/** Desvio que, no futuro, abre o convite do assessor (3.9). Só para quem está na faixa: hoje não aparece. */
export const LIMIAR_ASSESSOR_PP = 0.05; // 2 pontos percentuais de tolerância antes de considerar "fora do alvo"

/**
 * A ÚNICA régua de "fora do alvo" do app. Carteira (selo e sugestões) e Por objetivo (cards de
 * Aportar/Reduzir) usavam três folgas diferentes (1 p.p., 2 p.p. e zero): o selo dizia "abaixo
 * do alvo" sem sugestão nenhuma, e o card pedia "Reduzir" até quando a classe estava no alvo.
 */
export function strategyStatusOf(deviationPercent: number): StrategyClassPosition["status"] {
  return deviationPercent > TOLERANCE_PP ? "ACIMA" : deviationPercent < -TOLERANCE_PP ? "ABAIXO" : "DENTRO";
}

export async function getPortfolioStrategyComparison(ctx: AuthContext): Promise<{
  positions: StrategyClassPosition[];
  totalPortfolio: number;
}> {
  const [assets, strategyRows] = await Promise.all([
    prisma.asset.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId } }),
    prisma.portfolioStrategy.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId } }),
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
    const status = strategyStatusOf(deviationPercent);

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
