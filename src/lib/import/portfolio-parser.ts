import type { AssetClass } from "@prisma/client";
import { parseBrazilianNumber } from "./statement-parser";

/**
 * Parser de extrato/posição da corretora ou relatório da B3 (item 5.1). Identifica ativos pelo
 * código (ticker) e a quantidade — sem digitar posição por posição. Suporta:
 * - CSV simples (colunas código/quantidade/valor)
 * - texto solto contendo tickers da B3
 * - extratos em seções de banco/corretora (ex.: BTG "Extrato da Conta Investimento"), com
 *   várias tabelas por aba: Ações, BDRs, Fundos Listados, Renda Fixa (CDB/CRA/CRI/Debênture),
 *   Tesouro Direto e Portfólio de fundos.
 */

export type ParsedHolding = {
  ticker: string;
  quantity: number;
  /** Valor financeiro da posição, se encontrado; 0 quando o arquivo não traz. */
  value: number;
  /** Classe identificada pelo contexto do extrato (seção/coluna Tipo), quando disponível. */
  assetClass?: AssetClass;
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

/**
 * Número em formato brasileiro OU americano — extratos de banco (BTG) exportam Excel com
 * "1,520.80" enquanto B3/planilhas nacionais usam "1.520,80". Decide pelo último separador.
 */
function parseFlexibleNumber(raw: string): number {
  const t = raw.replace(/[R$\s%]/g, "");
  if (!t || t === "-" || t === "–") return NaN;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    normalized =
      t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".") // 1.520,80 → BR
        : t.replace(/,/g, ""); // 1,520.80 → US
  } else if (hasComma) {
    // Só vírgula: decimal se 1–2 casas ("19,01"); senão é milhar ("1,520" é raro — trata como US)
    normalized = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, ""); // 3.500 / 1.234.567 → milhar BR
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
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

// ---------------------------------------------------------------------------
// Extrato em seções (BTG e similares)
// ---------------------------------------------------------------------------

/** O que a tabela ativa do momento representa, com o índice de cada coluna relevante. */
type ActiveTable =
  | { kind: "ticker"; tickerCol: number; qtyCol: number; valueCol: number; typeCol: number }
  | { kind: "rendaFixa"; nameCol: number; emissorCol: number; qtyCol: number; valueCol: number }
  | { kind: "fundo"; dateCol: number; qtyCol: number; valueCol: number };

const DATE_RE = /^\d{2}\/\d{2}\/\d{2,4}$/;

/** Nome do fundo sem o sufixo cadastral ("… - Classe CNPJ: 00.000…" e asteriscos). */
function cleanFundName(name: string): string {
  return name
    .replace(/\s*-\s*Classe CNPJ:.*$/i, "")
    .replace(/\s*-\s*C[óo]d\. Subclasse:.*$/i, "")
    .replace(/\*+$/, "")
    .trim();
}

/**
 * Extratos de banco (ex.: BTG) vêm como várias tabelas em seções: "Posição > Ações",
 * "Posição > Fundos Listados", "Posição > CRA", "Posição > TESOURO DIRETO - LFT"…
 * Cada seção tem seu cabeçalho e linhas de dados, encerradas por uma linha "Total".
 * Seções de Movimentação/Detalhamento repetem as posições e são puladas (evita duplicar),
 * assim como Aluguel de ações (as ações alugadas já contam na posição).
 */
function parseSectionedHoldings(lines: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  let skipping = false;
  let section = "";
  let table: ActiveTable | null = null;
  let pendingFundName: string | null = null;
  // Só entra no modo "seções" depois de ver um marcador ("Posição >" etc.) — CSVs simples
  // sem marcador seguem no caminho clássico (parseCsvHoldings), que já os trata bem.
  let sawSection = false;

  for (const line of lines) {
    const cells = line.split(";").map((c) => c.trim());
    const nonEmpty = cells.filter((c) => c !== "");
    if (nonEmpty.length === 0) continue;
    const first = nonEmpty[0];
    const firstLower = first.toLowerCase();

    // Marcadores de seção
    if (/^(movimenta|detalhamento|posi[cç][õo]es detalhadas)/.test(firstLower)) {
      skipping = true;
      table = null;
      continue;
    }
    if (/^posi[cç][ãa]o\s*>/.test(firstLower) || /^posi[cç][õo]es?$/.test(firstLower)) {
      sawSection = true;
      section = firstLower.includes(">") ? first.split(">")[1].trim().toLowerCase() : "";
      skipping = section.includes("aluguel");
      table = null;
      pendingFundName = null;
      continue;
    }
    if (skipping || !sawSection) continue;

    // Linha "Total …" encerra a tabela ativa
    if (/^total\b/.test(firstLower)) {
      table = null;
      pendingFundName = null;
      continue;
    }

    // Detecção de cabeçalho de tabela
    const lower = cells.map((c) => c.toLowerCase());
    const hasCell = (needle: string) => lower.some((c) => c.includes(needle));
    if (hasCell("código") && (hasCell("qtde") || hasCell("quantidade"))) {
      const saldoCol = lower.findIndex((c) => c.includes("saldo bruto"));
      table = {
        kind: "ticker",
        tickerCol: lower.findIndex((c) => c.includes("código")),
        qtyCol: lower.findIndex((c) => c.includes("qtde") || c.includes("quantidade")),
        valueCol: saldoCol !== -1 ? saldoCol : findCol(lower, VALUE_HEADERS),
        typeCol: lower.findIndex((c) => c === "tipo"),
      };
      continue;
    }
    if (hasCell("emissor") && lower.includes("ativo") && hasCell("quantidade")) {
      table = {
        kind: "rendaFixa",
        nameCol: lower.indexOf("ativo"),
        emissorCol: lower.findIndex((c) => c.includes("emissor")),
        qtyCol: lower.findIndex((c) => c.includes("quantidade")),
        valueCol: lower.findIndex((c) => c.includes("saldo bruto")),
      };
      continue;
    }
    if (hasCell("data referência") && hasCell("quantidade de cotas")) {
      table = {
        kind: "fundo",
        dateCol: lower.findIndex((c) => c.includes("data referência")),
        qtyCol: lower.findIndex((c) => c.includes("quantidade de cotas")),
        valueCol: lower.findIndex((c) => c.includes("saldo bruto")),
      };
      pendingFundName = null;
      continue;
    }

    if (!table) continue;

    // Linhas de dados
    if (table.kind === "ticker") {
      const ticker = (cells[table.tickerCol] ?? "").toUpperCase();
      if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) continue;
      const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
      const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
      const tipo = table.typeCol !== -1 ? (cells[table.typeCol] ?? "").toUpperCase() : "";
      holdings.push({
        ticker,
        quantity: Number.isNaN(quantity) ? 0 : quantity,
        value: Number.isNaN(value) ? 0 : Math.abs(value),
        assetClass: tipo === "FII" ? "FII" : guessAssetClass(ticker),
      });
    } else if (table.kind === "rendaFixa") {
      const name = cells[table.nameCol] ?? "";
      if (!name || name === "-") continue;
      const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
      const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
      if (Number.isNaN(quantity) && Number.isNaN(value)) continue;
      const isTesouro = section.includes("tesouro") || /^(LFT|LTN|NTN)/i.test(name);
      const emissor = cells[table.emissorCol] ?? "";
      holdings.push({
        // Tesouro usa o nome do título (LFT, NTNB-P); o resto ganha o emissor pra ficar legível.
        ticker: isTesouro || !emissor ? name : `${name} (${emissor})`,
        quantity: Number.isNaN(quantity) ? 0 : quantity,
        value: Number.isNaN(value) ? 0 : Math.abs(value),
        assetClass: isTesouro ? "TESOURO_DIRETO" : "RENDA_FIXA",
      });
    } else {
      // Portfólio de fundos: linha de NOME (célula única, sem data) alternada com linha de DADOS
      const firstCell = cells[table.dateCol] ?? "";
      if (DATE_RE.test(firstCell)) {
        if (!pendingFundName) continue;
        const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
        const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
        holdings.push({
          ticker: pendingFundName,
          quantity: Number.isNaN(quantity) ? 0 : quantity,
          value: Number.isNaN(value) ? 0 : Math.abs(value),
          assetClass: "FUNDO",
        });
        pendingFundName = null;
      } else if (nonEmpty.length === 1) {
        pendingFundName = cleanFundName(first);
      }
    }
  }

  return holdings;
}

export function parsePortfolioStatement(content: string): ParsedHolding[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // 1º: extrato em seções (BTG e similares) — só produz resultado se achar as tabelas típicas.
  const sectioned = parseSectionedHoldings(lines);
  if (sectioned.length > 0) return mergeByTicker(sectioned);

  // Se a 1ª linha parece cabeçalho com coluna de código, trata como CSV estruturado.
  const firstLower = lines[0].toLowerCase();
  const looksCsv = TICKER_HEADERS.some((h) => firstLower.includes(h)) && /[;,\t]/.test(lines[0]);

  const raw = looksCsv ? parseCsvHoldings(lines) : parseTextHoldings(lines);
  return mergeByTicker(raw);
}
