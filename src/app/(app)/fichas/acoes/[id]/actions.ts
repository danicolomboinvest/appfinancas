"use server";

import { fetchStockIndicators } from "@/lib/analysis/stock-scraper";
import { fetchAnalisedeacoesIndicators, toScrapedCriteria } from "@/lib/analysis/analisedeacoes-scraper";
import {
  buildStockOverview,
  OVERVIEW_DISCLAIMER,
  type OverviewItem,
  type OverviewSignal,
} from "@/lib/analysis/stock-overview";

export type FetchStockIndicatorsResult =
  | { ok: true; results: { key: string; value: string }[] }
  | { ok: false; error: string };

/**
 * Busca os indicadores públicos do ticker. Usa o investidor10 como fonte principal e o
 * analisedeacoes como 2ª fonte: o que a 1ª não trouxer, a 2ª completa (mais critérios
 * preenchidos automaticamente). Se a 2ª falhar, seguimos só com a 1ª — não quebra.
 */
export async function fetchStockIndicatorsAction(ticker: string): Promise<FetchStockIndicatorsResult> {
  if (!ticker.trim()) {
    return { ok: false, error: "Ticker vazio." };
  }
  try {
    const primary = await fetchStockIndicators(ticker);
    const seen = new Set(primary.map((r) => r.key));
    const merged = [...primary];
    try {
      const secondary = toScrapedCriteria(await fetchAnalisedeacoesIndicators(ticker));
      for (const r of secondary) {
        if (!seen.has(r.key)) {
          seen.add(r.key);
          merged.push(r);
        }
      }
    } catch {
      /* 2ª fonte indisponível — segue com a principal */
    }

    if (merged.length === 0) {
      return { ok: false, error: `Nenhum dado encontrado para ${ticker.toUpperCase()}. Confira se o ticker está correto.` };
    }
    return { ok: true, results: merged };
  } catch {
    return { ok: false, error: `Não foi possível buscar dados para ${ticker.toUpperCase()} agora. Tente novamente.` };
  }
}

export type FetchStockOverviewResult =
  | { ok: true; items: OverviewItem[]; counts: Record<OverviewSignal, number>; disclaimer: string }
  | { ok: false; error: string };

/**
 * Overview educativo da empresa: indicadores da analisedeacoes com um "selo" por indicador
 * (Favorável / Na média / Atenção) contra uma referência geral e transparente. NÃO é
 * recomendação de compra/venda — o aviso vai junto (OVERVIEW_DISCLAIMER).
 */
export async function fetchStockOverviewAction(ticker: string): Promise<FetchStockOverviewResult> {
  if (!ticker.trim()) return { ok: false, error: "Ticker vazio." };
  try {
    const indicators = await fetchAnalisedeacoesIndicators(ticker);
    const { items, counts } = buildStockOverview(indicators);
    if (items.length === 0) {
      return { ok: false, error: `Sem indicadores para analisar ${ticker.toUpperCase()} agora.` };
    }
    return { ok: true, items, counts, disclaimer: OVERVIEW_DISCLAIMER };
  } catch {
    return { ok: false, error: `Não foi possível carregar a análise de ${ticker.toUpperCase()} agora.` };
  }
}
