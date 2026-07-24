"use server";

import { fetchEtfIndicators } from "@/lib/analysis/etf-scraper";
import { buildEtfOverview, OVERVIEW_DISCLAIMER, type OverviewItem, type OverviewSignal } from "@/lib/analysis/etf-overview";

export type FetchEtfIndicatorsResult =
  | { ok: true; results: { key: string; value: string }[] }
  | { ok: false; error: string };

/** Busca os indicadores públicos do ETF no investidor10.com.br, sem IA, sem custo por chamada. */
export async function fetchEtfIndicatorsAction(ticker: string): Promise<FetchEtfIndicatorsResult> {
  if (!ticker.trim()) {
    return { ok: false, error: "Ticker vazio." };
  }
  try {
    const results = await fetchEtfIndicators(ticker);
    if (results.length === 0) {
      return { ok: false, error: `Nenhum dado encontrado para ${ticker.toUpperCase()}. Confira se o ticker está correto.` };
    }
    return { ok: true, results };
  } catch {
    return { ok: false, error: `Não foi possível buscar dados para ${ticker.toUpperCase()} agora. Tente novamente.` };
  }
}

export type FetchEtfOverviewResult =
  | { ok: true; items: OverviewItem[]; counts: Record<OverviewSignal, number>; disclaimer: string }
  | { ok: false; error: string };

/**
 * Overview educativo do ETF: indicadores do investidor10 com um "selo" por indicador (Favorável /
 * Na média / Atenção) contra uma referência geral e transparente. NÃO é recomendação de compra/
 * venda, o aviso vai junto (OVERVIEW_DISCLAIMER).
 */
export async function fetchEtfOverviewAction(ticker: string): Promise<FetchEtfOverviewResult> {
  if (!ticker.trim()) return { ok: false, error: "Ticker vazio." };
  try {
    const results = await fetchEtfIndicators(ticker);
    const indicators = Object.fromEntries(results.map((r) => [r.key, r.value]));
    const { items, counts } = buildEtfOverview(indicators);
    if (items.length === 0) {
      return { ok: false, error: `Sem indicadores para analisar ${ticker.toUpperCase()} agora.` };
    }
    return { ok: true, items, counts, disclaimer: OVERVIEW_DISCLAIMER };
  } catch {
    return { ok: false, error: `Não foi possível carregar a análise de ${ticker.toUpperCase()} agora.` };
  }
}
