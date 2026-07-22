import * as cheerio from "cheerio";

export type ScrapedCriterion = { key: string; value: string };

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Cards de cotação identificados pelo atributo title, mesmo padrão usado nos FIIs. */
const CARD_TITLE_TO_KEY: Record<string, string> = {
  Capitalização: "patrimonio_liquido_etf",
  DY: "dividend_yield_etf",
  "Variação (12M)": "rentabilidade_12m",
  "VARIAÇÃO (60M)": "rentabilidade_5anos",
};

/**
 * investidor10 hospeda ETFs listados na B3 em /etfs/{ticker}/ e ETFs americanos em
 * /etfs-global/{ticker}/, o próprio servidor redireciona (301) quando o ticker pedido está
 * na URL errada, então sempre tentar /etfs/ primeiro e deixar o fetch seguir o redirect resolve
 * os dois casos sem precisar o usuário informar onde o fundo é negociado.
 */
export function buildInvestidor10EtfUrl(ticker: string): string {
  return `https://investidor10.com.br/etfs/${ticker.trim().toLowerCase()}/`;
}

/**
 * Extrai os critérios com dado publicado (de 13 do catálogo de ETFs) direto do HTML estático
 * do investidor10, sem IA, sem custo por chamada. Taxa de administração, índice de referência,
 * método de réplica e concentração da carteira só aparecem em texto livre (varia por fundo) ou
 * em gráficos renderizados via JS, então continuam manuais.
 */
export function parseEtfPage(html: string): ScrapedCriterion[] {
  const $ = cheerio.load(html);
  const results: ScrapedCriterion[] = [];

  $("#cards-ticker ._card").each((_, el) => {
    const title = $(el).find("._card-header span[title]").first().attr("title");
    const key = title ? CARD_TITLE_TO_KEY[title] : undefined;
    if (!key) return;
    const value = $(el).find("._card-body span").first().text().trim();
    if (value) results.push({ key, value });
  });

  return results;
}

export async function fetchEtfIndicators(ticker: string): Promise<ScrapedCriterion[]> {
  const url = buildInvestidor10EtfUrl(ticker);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar dados para ${ticker.toUpperCase()} (HTTP ${res.status}).`);
  }
  const html = await res.text();
  return parseEtfPage(html);
}
