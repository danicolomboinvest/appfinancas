"use server";

import { fetchInternationalStockIndicators } from "@/lib/analysis/international-stock-scraper";
import { buildStockOverview, OVERVIEW_DISCLAIMER, type OverviewItem, type OverviewSignal } from "@/lib/analysis/stock-overview";

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

export type FetchStockIntlOverviewResult =
  | { ok: true; items: OverviewItem[]; counts: Record<OverviewSignal, number>; disclaimer: string }
  | { ok: false; error: string };

/**
 * Overview educativo da ação internacional: reaproveita o MESMO motor de regras de ações
 * brasileiras (stock-overview.ts) — os indicadores raspados (DY, ROE, ROIC, margem líquida,
 * dívida líquida/patrimônio, dívida líquida/EBITDA, evolução de receita/lucro) usam as mesmas
 * chaves, então as réguas já existentes fazem sentido igual pra ação internacional.
 */
export async function fetchStockIntlOverviewAction(ticker: string): Promise<FetchStockIntlOverviewResult> {
  if (!ticker.trim()) return { ok: false, error: "Ticker vazio." };
  try {
    const results = await fetchInternationalStockIndicators(ticker);
    const indicators = Object.fromEntries(results.map((r) => [r.key, r.value]));
    const { items, counts } = buildStockOverview(indicators);
    if (items.length === 0) {
      return { ok: false, error: `Sem indicadores para analisar ${ticker.toUpperCase()} agora.` };
    }
    return { ok: true, items, counts, disclaimer: OVERVIEW_DISCLAIMER };
  } catch {
    return { ok: false, error: `Não foi possível carregar a análise de ${ticker.toUpperCase()} agora.` };
  }
}
