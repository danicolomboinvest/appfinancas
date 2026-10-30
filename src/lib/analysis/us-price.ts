import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;

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
 * Lê a página do investidor10, a mesma fonte da cotação da B3, que tem as americanas em /stocks e
 * /etfs-global com o preço em US$. O Yahoo NÃO é usado: ele proíbe uso em app pago. Quando houver
 * fonte paga com licença, ela entra aqui na frente.
 */
export async function fetchUsPrice(ticker: string): Promise<number | null> {
  const t = ticker.trim().toUpperCase();
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
