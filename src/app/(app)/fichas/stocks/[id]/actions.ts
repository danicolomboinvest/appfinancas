"use server";

import { fetchInternationalStockIndicators } from "@/lib/analysis/international-stock-scraper";

export type FetchStockIntlIndicatorsResult =
  | { ok: true; results: { key: string; value: string }[] }
  | { ok: false; error: string };

/** Busca os indicadores públicos do ticker no investidor10.com.br, sem IA, sem custo por chamada. */
export async function fetchStockIntlIndicatorsAction(ticker: string): Promise<FetchStockIntlIndicatorsResult> {
  if (!ticker.trim()) {
    return { ok: false, error: "Ticker vazio." };
  }
  try {
    const results = await fetchInternationalStockIndicators(ticker);
    if (results.length === 0) {
      return { ok: false, error: `Nenhum dado encontrado para ${ticker.toUpperCase()}. Confira se o ticker está correto.` };
    }
    return { ok: true, results };
  } catch {
    return { ok: false, error: `Não foi possível buscar dados para ${ticker.toUpperCase()} agora. Tente novamente.` };
  }
}
