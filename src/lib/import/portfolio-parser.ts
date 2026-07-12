import type { AssetClass } from "@prisma/client";
import { parseBrazilianNumber } from "./statement-parser";

/**
 * Parser de extrato/posição da corretora ou relatório da B3 (item 5.1). Identifica ativos pelo
 * código (ticker) e a quantidade — sem digitar posição por posição. Suporta CSV (com colunas
 * código/quantidade/valor) e texto solto contendo tickers da B3.
 */

export type ParsedHolding = {
  ticker: string;
  quantity: number;
  /** Valor financeiro da posição, se encontrado; 0 quando o arquivo não traz. */
  value: number;
};

/** Ticker B3: 4 letras + 1–2 dígitos (PETR4, ITUB3, HGLG11, BOVA11). */
const TICKER_RE = /\b([A-Z]{4}\d{1,2})\b/;

/** Classe pela terminação do ticker: 11 → FII (dominante na B3), 3/4/5/6 → ação, resto → outro. */
export function guessAssetClass(ticker: string): AssetClass {
  if (/11$/.test(ticker)) return "FII";
  if (/[3456]$/.test(ticker)) return "ACAO";
  return "OUTRO";
}

const QTY_HEADERS = ["quantidade", "qtd", "quant", "quantity", "posicao", "posição"];
const VALUE_HEADERS = ["valor", "financeiro", "value", "total", "posicao", "montante"];
const TICKER_HEADERS = ["codigo", "código", "ticker", "papel", "ativo", "symbol"];

function detectDelimiter(line: string): string {
  return [";", "\t", ","].reduce((best, d) => (line.split(d).length > line.split(best).length ? d : best), ";");
}

function findCol(headers: string[], needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

function parseCsvHoldings(lines: string[]): ParsedHolding[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const tickerCol = findCol(headers, TICKER_HEADERS);
  const qtyCol = findCol(headers, QTY_HEADERS);
  const valueCol = findCol(headers, VALUE_HEADERS);
  if (tickerCol === -1) return [];

  const holdings: ParsedHolding[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((c) => c.trim());
    const tickerMatch = (cols[tickerCol] ?? "").toUpperCase().match(TICKER_RE);
    if (!tickerMatch) continue;
    const quantity = qtyCol !== -1 ? parseBrazilianNumber(cols[qtyCol] ?? "") : NaN;
    const value = valueCol !== -1 ? parseBrazilianNumber(cols[valueCol] ?? "") : NaN;
    holdings.push({
      ticker: tickerMatch[1],
      quantity: Number.isNaN(quantity) ? 0 : quantity,
      value: Number.isNaN(value) ? 0 : Math.abs(value),
    });
  }
  return holdings;
}

/** Texto solto: cada linha com um ticker; pega o 1º número como quantidade e o maior como valor. */
function parseTextHoldings(lines: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  for (const line of lines) {
    const upper = line.toUpperCase();
    const tickerMatch = upper.match(TICKER_RE);
    if (!tickerMatch) continue;
    const numbers = (line.match(/-?[\d.]+,\d+|\b\d+\b/g) ?? []).map(parseBrazilianNumber).filter((n) => !Number.isNaN(n));
    const quantity = numbers[0] ?? 0;
    const value = numbers.length > 1 ? Math.max(...numbers.slice(1)) : 0;
    holdings.push({ ticker: tickerMatch[1], quantity, value });
  }
  return holdings;
}

/** Soma posições repetidas do mesmo ticker (ex.: várias linhas de compra). */
function mergeByTicker(holdings: ParsedHolding[]): ParsedHolding[] {
  const map = new Map<string, ParsedHolding>();
  for (const h of holdings) {
    const existing = map.get(h.ticker);
    if (existing) {
      existing.quantity += h.quantity;
      existing.value += h.value;
    } else {
      map.set(h.ticker, { ...h });
    }
  }
  return [...map.values()];
}

export function parsePortfolioStatement(content: string): ParsedHolding[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Se a 1ª linha parece cabeçalho com coluna de código, trata como CSV estruturado.
  const firstLower = lines[0].toLowerCase();
  const looksCsv = TICKER_HEADERS.some((h) => firstLower.includes(h)) && /[;,\t]/.test(lines[0]);

  const raw = looksCsv ? parseCsvHoldings(lines) : parseTextHoldings(lines);
  return mergeByTicker(raw);
}
