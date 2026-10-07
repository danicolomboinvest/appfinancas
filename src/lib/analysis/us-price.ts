import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;

/** O pedaço da resposta do Yahoo que interessa. */
type YahooChart = { chart?: { result?: { meta?: { currency?: string; regularMarketPrice?: number } }[] | null } };

/** Preço em US$ da resposta do gráfico do Yahoo; null se não veio ou não é em dólar. */
export function parseYahooPrice(payload: unknown): number | null {
  const meta = (payload as YahooChart)?.chart?.result?.[0]?.meta;
  if (!meta || meta.currency !== "USD") return null;
  const preco = Number(meta.regularMarketPrice);
  return Number.isFinite(preco) && preco > 0 ? preco : null;
}

/** "US$ 716,86" (como o investidor10 escreve) → 716.86. */
export function parseUsdText(text: string): number | null {
  const m = text.replace(/\s/g, " ").match(/US\$\s?([\d.]+,\d{2})/);
  if (!m) return null;
  const v = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function buscar(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/**
 * Cotação de ação ou ETF americano em dólar (VOO, AAPL, BRK.B), para a conta no exterior.
 *
 * Primeiro o Yahoo (JSON limpo, preço do pregão); se falhar, a página do investidor10, a mesma
 * fonte da cotação da B3, que tem as americanas em /stocks e /etfs-global com o preço em US$.
 */
export async function fetchUsPrice(ticker: string): Promise<number | null> {
  const t = ticker.trim().toUpperCase();
  // O Yahoo escreve a classe com hífen: BRK.B é BRK-B. Ele recusa às vezes por excesso de
  // pedidos (429): tenta o segundo endereço dele antes de ir pro investidor10.
  for (const host of ["query1", "query2"]) {
    const yahoo = await buscar(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.replace(".", "-"))}?range=1d&interval=1d`);
    if (!yahoo) continue;
    try {
      const preco = parseYahooPrice(await yahoo.json());
      if (preco !== null) return preco;
    } catch {
      // Resposta que não é JSON: tenta a outra fonte.
    }
  }
  const slug = t.toLowerCase().replace(".", "-");
  for (const caminho of ["stocks", "etfs-global"]) {
    const res = await buscar(`https://investidor10.com.br/${caminho}/${slug}/`);
    if (!res) continue;
    const $ = cheerio.load(await res.text());
    const preco = parseUsdText($("._card.cotacao").first().text());
    if (preco !== null) return preco;
  }
  return null;
}
