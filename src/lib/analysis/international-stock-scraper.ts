import * as cheerio from "cheerio";

export type ScrapedCriterion = { key: string; value: string };

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Rótulos exibidos em #table-indicators (ações internacionais) mapeados para as keys do catálogo. */
const RATIO_LABEL_TO_KEY: Record<string, string> = {
  "Dividend Yield (DY)": "dividend_yield",
  Payout: "payout",
  "Margem Líquida": "margem_liquida",
  ROE: "roe",
  ROIC: "roic",
  "Dívida Líquida / Patrimônio": "divida_liquida_patrimonio",
  "Dívida Líquida / EBITDA": "divida_liquida_ebitda",
  "CAGR Receitas 5 Anos": "evolucao_receita",
  "CAGR Lucros 5 Anos": "evolucao_lucro",
};

export function buildInvestidor10StockUrl(ticker: string): string {
  return `https://investidor10.com.br/stocks/${ticker.trim().toLowerCase()}/`;
}

/**
 * Extrai os critérios com dado publicado (de 22 do catálogo de Stocks) direto do HTML estático
 * da página de ações internacionais do investidor10, sem IA, sem custo por chamada. Diferente
 * da página de ações brasileiras, aqui não existe Tag Along/Free Float (conceitos específicos
 * da B3), mas "Volume Médio de negociações Diária" cobre o mesmo papel de `liquidez`.
 */
export function parseInternationalStockPage(html: string): ScrapedCriterion[] {
  const $ = cheerio.load(html);
  const results: ScrapedCriterion[] = [];

  $("#table-indicators.four_columns .cell").each((_, el) => {
    const label = $(el).find("h3.d-flex").first().clone().children().remove().end().text().trim();
    const key = RATIO_LABEL_TO_KEY[label];
    if (!key) return;
    const value = $(el).find(".value span").first().text().trim();
    if (value) results.push({ key, value });
  });

  $("#table-indicators-company .cell").each((_, el) => {
    const title = $(el).find("h3.title").first().text().trim();
    if (title === "Volume Médio de negociações Diária") {
      const value = $(el).find(".simple-value").first().text().trim();
      if (value) results.push({ key: "liquidez", value });
    }
  });

  return results;
}

export async function fetchInternationalStockIndicators(ticker: string): Promise<ScrapedCriterion[]> {
  const url = buildInvestidor10StockUrl(ticker);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar dados para ${ticker.toUpperCase()} (HTTP ${res.status}).`);
  }
  const html = await res.text();
  return parseInternationalStockPage(html);
}
