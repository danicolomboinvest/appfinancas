import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Mesmo caminho em cascata do price-scraper (o mesmo ticker pode ser ação, FII, ETF ou BDR),
 * mais "stocks" pras ações internacionais (não cobertas por fetchTickerPrice). */
const PATHS = ["acoes", "fiis", "etfs", "stocks", "bdrs"] as const;

/**
 * Só vale tentar buscar proventos se o campo "ticker" parece mesmo um ticker de bolsa — senão
 * gasta requisição à toa (e arrisca ser bloqueado) em cima de nomes descritivos de renda fixa
 * ("CDB Banco Inter 2027", "Tesouro IPCA+ 2035"), que o app aceita no mesmo campo.
 */
export function looksLikeMarketTicker(ticker: string): boolean {
  const clean = ticker.trim().toUpperCase();
  // B3 (ações, FIIs, ETFs BR, BDRs): 4 letras + 1-2 dígitos — PETR4, MXRF11, BOVA11.
  if (/^[A-Z]{4}\d{1,2}$/.test(clean)) return true;
  // Internacional (stocks, ETFs globais): 1-5 letras, sem dígito — AAPL, SCHD, VOO.
  if (/^[A-Z]{1,5}$/.test(clean)) return true;
  return false;
}

export type DividendRow = {
  kind: string;
  exDate: Date;
  paymentDate: Date;
  valuePerShare: number;
};

/** "21/08/2026" → Date (meio-dia local, evita o dia "voltar" na conversão UTC). */
function parseBrDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** " 0,20250435\n    " → 0.20250435 */
function parseBrDecimal(text: string): number | null {
  const cleaned = text.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Tabela "#table-dividends-history" existe (mesmo formato: tipo/data com/pagamento/valor) nas
 * páginas de ações, FIIs, ETFs internacionais (via /etfs-global/) e stocks internacionais do
 * investidor10. ETFs brasileiros de ações não têm essa tabela (o fundo reinveste em vez de
 * distribuir) — página válida, zero linhas, comportamento correto, não é erro.
 */
export function parseDividendHistory(html: string): DividendRow[] {
  const $ = cheerio.load(html);
  const rows: DividendRow[] = [];

  $("#table-dividends-history tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 4) return;
    const kind = $(cells[0]).text().trim();
    const exDate = parseBrDate($(cells[1]).text());
    const paymentDate = parseBrDate($(cells[2]).text());
    const valuePerShare = parseBrDecimal($(cells[3]).text());
    if (!kind || !exDate || !paymentDate || valuePerShare === null) return;
    rows.push({ kind, exDate, paymentDate, valuePerShare });
  });

  return rows;
}

/**
 * Busca o histórico de proventos de um ticker B3/internacional no investidor10. Tenta cada
 * seção até achar a página (mesma estratégia do fetchTickerPrice); array vazio é resultado
 * válido (ticker existe mas não paga provento, ou tabela momentaneamente sem linhas) — só
 * `null` significa "não achei o ticker em nenhuma seção".
 */
export async function fetchTickerDividends(ticker: string): Promise<DividendRow[] | null> {
  const slug = ticker.trim().toLowerCase();
  for (const path of PATHS) {
    try {
      const res = await fetch(`https://investidor10.com.br/${path}/${slug}/`, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Página existe de verdade (tem o card de cotação OU a seção de dividendos) — resultado
      // vazio aqui é "ticker achado, sem provento", não "seção errada, tenta a próxima".
      if (html.includes("table-dividends-history") || html.includes("_card.cotacao") || html.includes('class="cotacao"')) {
        return parseDividendHistory(html);
      }
    } catch {
      // Falha de rede num caminho não deve derrubar a tentativa nos outros.
    }
  }
  return null;
}
