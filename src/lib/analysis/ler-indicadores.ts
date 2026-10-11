import type { SheetType } from "@prisma/client";
import { fetchStockIndicators } from "./stock-scraper";
import { fetchAnalisedeacoesIndicators } from "./analisedeacoes-scraper";
import { fetchInternationalStockIndicators } from "./international-stock-scraper";
import { fetchFiiIndicators } from "./fii-scraper";
import { fetchEtfIndicators } from "./etf-scraper";

/**
 * Todos os indicadores que dá pra raspar do ticker, por tipo. Pra ação brasileira, duas fontes
 * se completam (o que a primeira não traz, a segunda cobre); se a segunda falhar, segue só com
 * a primeira. Nunca derruba por uma fonte fora do ar.
 */
export async function scrapeIndicators(sheetType: SheetType, ticker: string): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};
  const absorb = (rows: { key: string; value: string }[]) => {
    for (const r of rows) if (!(r.key in merged)) merged[r.key] = r.value;
  };
  const tenta = async (fn: () => Promise<{ key: string; value: string }[]>) => {
    try {
      absorb(await fn());
    } catch {
      /* fonte indisponível agora: as outras seguem */
    }
  };

  if (sheetType === "STOCK") {
    await tenta(async () => Object.entries(await fetchAnalisedeacoesIndicators(ticker)).map(([key, value]) => ({ key, value })));
    await tenta(() => fetchStockIndicators(ticker));
  } else if (sheetType === "STOCK_INTL") {
    await tenta(() => fetchInternationalStockIndicators(ticker));
  } else if (sheetType === "FII") {
    await tenta(() => fetchFiiIndicators(ticker));
  } else {
    await tenta(() => fetchEtfIndicators(ticker));
  }
  return merged;
}

