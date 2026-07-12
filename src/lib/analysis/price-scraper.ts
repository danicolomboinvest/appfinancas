import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Caminhos do investidor10 a tentar, na ordem — o mesmo ticker pode ser ação, FII ou ETF. */
const PATHS = ["acoes", "fiis", "etfs", "bdrs"] as const;

/** "R$ 39,65" → 39.65 */
export function parsePriceText(text: string): number | null {
  const match = text.replace(/\s/g, " ").match(/R\$\s?([\d.]+,\d{2})/);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function extractPriceFromPage(html: string): number | null {
  const $ = cheerio.load(html);
  const card = $("._card.cotacao").first();
  if (card.length === 0) return null;
  return parsePriceText(card.text());
}

/**
 * Busca a cotação atual de um ticker B3 no investidor10 (mesma fonte já usada nas fichas).
 * Tenta ações → FIIs → ETFs → BDRs até achar a página com o card de cotação.
 * Retorna null quando o ticker não é encontrado em nenhuma seção.
 */
export async function fetchTickerPrice(ticker: string): Promise<number | null> {
  const slug = ticker.trim().toLowerCase();
  for (const path of PATHS) {
    try {
      const res = await fetch(`https://investidor10.com.br/${path}/${slug}/`, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const price = extractPriceFromPage(await res.text());
      if (price !== null) return price;
    } catch {
      // Falha de rede num caminho não deve derrubar a tentativa nos outros.
    }
  }
  return null;
}
