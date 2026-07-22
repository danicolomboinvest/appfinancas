import * as cheerio from "cheerio";

export type ScrapedCriterion = { key: string; value: string };

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Rótulos exibidos em #table-indicators mapeados para as keys de prisma/criteria-catalog.ts. */
const RATIO_LABEL_TO_KEY: Record<string, string> = {
  "Dívida Líquida / Patrimônio": "divida_liquida_patrimonio",
  "Dívida Líquida / Ebitda": "divida_liquida_ebitda",
  "Margem Líquida": "margem_liquida",
  ROE: "roe",
  ROIC: "roic",
  Payout: "payout",
  "Dividend Yield": "dividend_yield",
  "CAGR Receitas 5 anos": "evolucao_receita",
  "CAGR Lucros 5 anos": "evolucao_lucro",
};

export function buildInvestidor10Url(ticker: string): string {
  return `https://investidor10.com.br/acoes/${ticker.trim().toLowerCase()}/`;
}

/**
 * Extrai os 12 critérios com dado publicado (de 22 do catálogo) direto do HTML estático da
 * página de ações do investidor10, sem IA, sem custo por chamada. Os outros 10 (qualitativos
 * que dependem de pesquisa/julgamento) não têm fonte confiável na página e continuam manuais.
 */
export function parseStockPage(html: string): ScrapedCriterion[] {
  const $ = cheerio.load(html);
  const results: ScrapedCriterion[] = [];

  $("#table-indicators-company .cell").each((_, el) => {
    const title = $(el).find(".title").first().text().trim();
    if (title === "Free Float" || title === "Tag Along") {
      const value = $(el).find(".value").first().clone().children("i").remove().end().text().trim();
      if (value) results.push({ key: title === "Free Float" ? "free_float" : "tag_along", value });
    } else if (title === "Liquidez Média Diária") {
      const value = $(el).find(".simple-value").first().text().trim();
      if (value) results.push({ key: "liquidez", value });
    }
  });

  $("#table-indicators .cell").each((_, el) => {
    const label = $(el).find("span.d-flex").first().clone().children().remove().end().text().trim();
    const key = RATIO_LABEL_TO_KEY[label];
    if (!key) return;
    const value = $(el).find(".value span").first().text().trim();
    if (value) results.push({ key, value });
  });

  return results;
}

export async function fetchStockIndicators(ticker: string): Promise<ScrapedCriterion[]> {
  const url = buildInvestidor10Url(ticker);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar dados para ${ticker.toUpperCase()} (HTTP ${res.status}).`);
  }
  const html = await res.text();
  return parseStockPage(html);
}
