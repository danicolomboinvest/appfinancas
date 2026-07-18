import * as cheerio from "cheerio";

export type ScrapedCriterion = { key: string; value: string };

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Fonte complementar de indicadores de ações (analisedeacoes.com). Serve como 2ª fonte para os
 * critérios da ficha (completa o que o investidor10 não trouxe) e alimenta o overview educativo
 * com indicadores de valuation que a ficha não tinha (P/L, P/VP, EV/EBITDA, margens, liquidez).
 *
 * A página expõe cada indicador como <div class="card-info-item"> com <strong class="item-label">
 * e <span class="item-value"> — HTML estático, sem JS, então dá pra raspar server-side.
 */

/** Rótulos EXATOS da página (abreviados/minúsculos) → keys internas. Cobre os critérios da ficha
 * e os indicadores do overview. Confirmado contra a página real (ex.: "Margem líq.", "Liq. corrente"). */
const LABEL_TO_KEY: Record<string, string> = {
  DY: "dividend_yield",
  "P/L": "p_l",
  "P/VP": "p_vp",
  LPA: "lpa",
  VPA: "vpa",
  PSR: "psr",
  "P/EBIT": "p_ebit",
  "EV/Ebit": "ev_ebit",
  "EV/Ebitda": "ev_ebitda",
  "C. RECEITA 5A": "evolucao_receita",
  "C. LUCRO 5A": "evolucao_lucro",
  ROE: "roe",
  ROIC: "roic",
  "Margem bruta": "margem_bruta",
  "Margem ebit": "margem_ebit",
  "Margem líq.": "margem_liquida",
  "Liq. corrente": "liquidez_corrente",
  "Dívida liq / pl": "divida_liquida_patrimonio",
  "Dív. liq / ebitda": "divida_liquida_ebitda",
  "Tag along": "tag_along",
  "Free float": "free_float",
};

export function buildAnalisedeacoesUrl(ticker: string): string {
  return `https://www.analisedeacoes.com/acoes/${ticker.trim().toLowerCase()}/`;
}

/** Extrai TODOS os indicadores da página como { key → value } (só os rótulos que conhecemos). */
export function parseAnalisedeacoesPage(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const out: Record<string, string> = {};
  $(".card-info-item").each((_, el) => {
    const label = $(el).find(".item-label").first().text().trim();
    const key = LABEL_TO_KEY[label];
    if (!key || out[key] !== undefined) return;
    // O valor tem um <span> de ícone dentro — removemos os filhos e ficamos com o texto.
    const value = $(el).find(".item-value").first().clone().children().remove().end().text().trim();
    if (value) out[key] = value;
  });
  return out;
}

/** Converte o mapa em critérios da ficha (formato compartilhado com os outros scrapers). */
export function toScrapedCriteria(map: Record<string, string>): ScrapedCriterion[] {
  return Object.entries(map).map(([key, value]) => ({ key, value }));
}

export async function fetchAnalisedeacoesIndicators(ticker: string): Promise<Record<string, string>> {
  const res = await fetch(buildAnalisedeacoesUrl(ticker), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`analisedeacoes: HTTP ${res.status} para ${ticker.toUpperCase()}`);
  return parseAnalisedeacoesPage(await res.text());
}
