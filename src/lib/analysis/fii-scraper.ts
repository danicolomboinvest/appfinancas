import * as cheerio from "cheerio";

export type ScrapedCriterion = { key: string; value: string };

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Rótulos da tabela "Informações sobre o fundo" mapeados para as keys de prisma/criteria-catalog.ts. */
const INFO_LABEL_TO_KEY: Record<string, string> = {
  MANDATO: "mandato",
  SEGMENTO: "segmento",
  "TIPO DE GESTÃO": "tipo_gestao",
  "TAXA DE ADMINISTRAÇÃO": "taxa_administracao",
  "VALOR PATRIMONIAL": "patrimonio_liquido",
  VACÂNCIA: "vacancia_atual",
};

/** Cards de cotação (P/VP, Liquidez Diária), identificados pelo atributo title, não por texto solto. */
const CARD_TITLE_TO_KEY: Record<string, string> = {
  "Liquidez Diária": "liquidez_fii",
  "P/VP": "p_vp",
};

export function buildInvestidor10FiiUrl(ticker: string): string {
  return `https://investidor10.com.br/fiis/${ticker.trim().toLowerCase()}/`;
}

/**
 * Extrai os critérios com dado publicado (de 27 do catálogo de FIIs) direto do HTML estático da
 * página do investidor10, sem IA, sem custo por chamada. Critérios que dependem de julgamento
 * (qualidade dos imóveis/inquilinos, riscos) ou só aparecem em gráficos renderizados via JS
 * (histórico de vacância, composição de CRIs) não têm fonte confiável na página estática e
 * continuam manuais.
 */
export function parseFiiPage(html: string): ScrapedCriterion[] {
  const $ = cheerio.load(html);
  const results: ScrapedCriterion[] = [];

  $(".table-info-fii .cell").each((_, el) => {
    const label = $(el).find(".name").first().clone().children().remove().end().text().trim();
    const key = INFO_LABEL_TO_KEY[label];
    if (!key) return;
    const value = $(el).find(".value span").first().text().trim();
    if (value) results.push({ key, value });
  });

  $("#cards-ticker ._card").each((_, el) => {
    const title = $(el).find("._card-header span[title]").first().attr("title");
    const key = title ? CARD_TITLE_TO_KEY[title] : undefined;
    if (!key) return;
    const value = $(el).find("._card-body span").first().text().trim();
    if (value) results.push({ key, value });
  });

  const propertyCount = $(".card-propertie").length;
  if (propertyCount > 0) {
    results.push({ key: "numero_imoveis", value: String(propertyCount) });
  }

  return results;
}

export async function fetchFiiIndicators(ticker: string): Promise<ScrapedCriterion[]> {
  const url = buildInvestidor10FiiUrl(ticker);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar dados para ${ticker.toUpperCase()} (HTTP ${res.status}).`);
  }
  const html = await res.text();
  return parseFiiPage(html);
}
