import type { SheetType } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { getPortfolioStrategyComparison, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import type { StrategyAssetClass } from "@prisma/client";
import { parseIndicatorNumber } from "./stock-overview";
import type { Laudo } from "./laudo";

/**
 * "E para você?" — a parte do laudo que só ESTE app consegue escrever.
 *
 * O Investidor10 diz se a empresa é boa. Só o SPI Finance sabe que a pessoa já tem 11% da
 * carteira nela, que a estratégia pede 40% em ações e ela está em 47%, e quanto de dividendo
 * R$ 1.000 dariam por mês. Nada aqui é recomendação: é a carteira e a estratégia da pessoa,
 * lidas junto com os números do ativo.
 */

export type ParaVoce = {
  /** Quanto a pessoa já tem NESTE ticker. null se não tem. */
  position: { value: number; percentOfPortfolio: number } | null;
  /** A classe da estratégia onde este ativo cai, com alvo × atual. null sem estratégia definida. */
  strategy: { classLabel: string; targetPercent: number; currentPercent: number; status: "ACIMA" | "DENTRO" | "ABAIXO" } | null;
  /** Dividendo mensal estimado pra cada R$ 1.000, a partir do DY dos últimos 12 meses. null sem DY. */
  monthlyIncomePerThousand: number | null;
  totalPortfolio: number;
};

const CLASS_BY_SHEET_TYPE: Record<SheetType, StrategyAssetClass> = {
  STOCK: "ACOES_BRASIL",
  FII: "FIIS",
  STOCK_INTL: "EXTERIOR",
  ETF: "ACOES_BRASIL",
};

function dividendYieldOf(laudo: Laudo | null): number | null {
  if (!laudo) return null;
  for (const s of laudo.sections) {
    for (const i of s.items) {
      if (i.key === "dividend_yield" || i.key === "dividend_yield_etf") return parseIndicatorNumber(i.value);
    }
  }
  return null;
}

export async function getParaVoce(ctx: AuthContext, sheetType: SheetType, ticker: string, laudo: Laudo | null): Promise<ParaVoce> {
  const [assets, comparison] = await Promise.all([listAssets(ctx), getPortfolioStrategyComparison(ctx)]);

  const alvo = ticker.trim().toUpperCase();
  const own = assets.filter((a) => (a.ticker ?? a.name).trim().toUpperCase() === alvo);
  const value = own.reduce((soma, a) => soma + Number(a.currentValue), 0);
  const position =
    own.length > 0 && comparison.totalPortfolio > 0
      ? { value, percentOfPortfolio: value / comparison.totalPortfolio }
      : null;

  const cls = CLASS_BY_SHEET_TYPE[sheetType];
  const pos = comparison.positions.find((p) => p.assetClass === cls);
  // Sem alvo definido na estratégia, não existe "pede X%": melhor calar do que comparar com zero.
  const strategy =
    pos && pos.targetPercent > 0
      ? { classLabel: STRATEGY_ASSET_CLASS_LABEL[cls], targetPercent: pos.targetPercent, currentPercent: pos.currentPercent, status: pos.status }
      : null;

  const dy = dividendYieldOf(laudo);
  const monthlyIncomePerThousand = dy !== null && dy > 0 ? (1000 * (dy / 100)) / 12 : null;

  return { position, strategy, monthlyIncomePerThousand, totalPortfolio: comparison.totalPortfolio };
}
