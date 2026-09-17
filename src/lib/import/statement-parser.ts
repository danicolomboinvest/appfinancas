/**
 * Parser de extrato bancário (item 3 da Rodada 2). Suporta OFX e CSV, os dois formatos de
 * exportação mais comuns dos bancos brasileiros. PDF não é suportado aqui (exige extração de
 * texto binário, fora do escopo sem lib dedicada); o usuário é orientado a exportar CSV/OFX.
 *
 * Convenção de sinal em `amount`: negativo = saída (vira EXPENSE), positivo = entrada (INCOME).
 */

import { isNubankStatement, parseNubankStatement } from "./nubank-pdf";

export type ParsedTransaction = {
  /** ISO (YYYY-MM-DD) quando possível; string original caso não dê pra normalizar. */
  date: string;
  description: string;
  /** Em reais. Negativo = gasto, positivo = entrada. */
  amount: number;
};

/** Converte "1.234,56", "1234.56", "-1.234,56", "R$ 100,00" em número. Retorna NaN se vazio. */
export function parseBrazilianNumber(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/gi, "").trim();
  if (cleaned === "") return NaN;
  // Se tem vírgula, ela é o separador decimal (padrão BR) e o ponto é de milhar.
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  return Number(normalized);
}

/**
 * Valor monetário em formato BR ("1.234,56") OU americano ("1,234.56", "87.53"), decide pelo
 * último separador. Bancos como o BTG exportam o extrato no formato americano; sem isso,
 * "-14,097.44" (14 mil) seria lido como 14,09.
 */
export function parseAmountFlexible(raw: string): number {
  let t = raw.replace(/[R$\s]/gi, "").trim();
  if (t === "" || t === "-") return NaN;
  // "(1.234,56)" é o jeito contábil de dizer negativo; "1.234,56 D" também.
  let negativeByMark = false;
  if (/^\(.*\)$/.test(t)) {
    negativeByMark = true;
    t = t.slice(1, -1);
  }
  // "1.234,56D" / "1.234,56 C" (o espaço já saiu): a letra no fim é o sinal.
  if (/\d[dDcC]$/.test(t)) {
    negativeByMark = negativeByMark || /[dD]$/.test(t);
    t = t.slice(0, -1);
  }
  const parsed = parseAmountCore(t);
  return negativeByMark && parsed > 0 ? -parsed : parsed;
}

function parseAmountCore(t: string): number {
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    // O separador mais à direita é o decimal.
    normalized = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, ""); // "1.234" sem decimais = separador de milhar BR
  } else {
    normalized = t;
  }
  return Number(normalized);
}

/** Normaliza data para ISO (YYYY-MM-DD). Aceita DD/MM/YYYY, YYYY-MM-DD e YYYYMMDD (OFX). */
export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // Aceita "DD/MM/YYYY" e também "DD/MM/YYYY HH:MM" (extrato BTG traz data e hora juntas).
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ofx = trimmed.match(/^(\d{4})(\d{2})(\d{2})/); // OFX DTPOSTED: YYYYMMDD[HHMMSS]
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  return trimmed;
}

function isOfx(content: string): boolean {
  return /<STMTTRN>|<OFX>/i.test(content);
}

function tag(block: string, name: string): string | null {
  // OFX "SGML" não fecha as tags, o valor vai até a próxima tag ou fim de linha.
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : null;
}

export function parseOfx(content: string): ParsedTransaction[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: ParsedTransaction[] = [];
  for (const block of blocks) {
    const amountRaw = tag(block, "TRNAMT");
    if (amountRaw === null) continue;
    const amount = parseBrazilianNumber(amountRaw);
    if (Number.isNaN(amount)) continue;
    const description = tag(block, "MEMO") ?? tag(block, "NAME") ?? "Lançamento";
    const date = normalizeDate(tag(block, "DTPOSTED") ?? "");
    transactions.push({ date, description: description.trim(), amount });
  }
  return transactions;
}

function detectDelimiter(line: string): string {
  const candidates = [";", "\t", ","];
  return candidates.reduce((best, d) => (line.split(d).length > line.split(best).length ? d : best), ";");
}

function splitCsvLine(line: string, delimiter: string): string[] {
  // Lida com campos entre aspas que podem conter o delimitador.
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((c) => c.trim().replace(/^"|"$/g, ""));
}

const DATE_HEADERS = ["data", "date", "dt"];
const DESC_HEADERS = ["descri", "histor", "histó", "lanç", "lanc", "memo", "estabelecimento", "detalhe", "title"];
const AMOUNT_HEADERS = ["valor", "amount", "montante", "quantia", "value"];
/** Coluna de valor que NÃO é a certa: "Valor (em US$)" do C6 vinha antes de "Valor (em R$)" e levava tudo. */
const AMOUNT_AVOID = ["us$", "usd", "dólar", "dolar", "cotação", "cotacao"];
/** Extratos com duas colunas (Bradesco, Santander, Sicoob, Caixa): crédito e débito separados. */
const CREDIT_HEADERS = ["crédito", "credito", "entrada", "credit"];
const DEBIT_HEADERS = ["débito", "debito", "saída", "saida", "debit"];
/** Coluna "D/C", "Natureza", "Tipo" com D ou C: o sinal vem dela. */
const DC_HEADERS = ["d/c", "natureza", "tipo"];
/** Coluna separada de "Transação"/"Tipo" (ex.: extrato BTG), enriquece a descrição. */
const TRANSACTION_HEADERS = ["transa", "tipo de lanç", "tipo"];
/** Linhas que NÃO são transações (saldo diário/atual/anterior, totais), não viram lançamento. */
const NON_TRANSACTION_RE = /\bsaldo\b/i;

function findColumn(headers: string[], needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

/** A coluna de valor certa: prefere "Valor (em R$)" / "valor" a "Valor (em US$)". */
function findAmountColumn(headers: string[]): number {
  const candidates = headers.map((h, i) => ({ h, i })).filter(({ h }) => AMOUNT_HEADERS.some((n) => h.includes(n)));
  if (candidates.length === 0) return -1;
  const good = candidates.filter(({ h }) => !AMOUNT_AVOID.some((a) => h.includes(a)));
  const pool = good.length > 0 ? good : candidates;
  const brl = pool.find(({ h }) => /r\$|brl|reais/.test(h));
  return (brl ?? pool[0]).i;
}

export function parseCsv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Procura a linha de CABEÇALHO, bancos (BTG etc.) põem metadados (cliente, conta, período)
  // antes dela. O cabeçalho é a 1ª linha que tenha coluna de valor + de data ou descrição.
  let headerIdx = -1;
  let delimiter = detectDelimiter(lines[0]);
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let transCol = -1;
  let creditCol = -1;
  let debitCol = -1;
  let dcCol = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const d = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], d).map((h) => h.toLowerCase());
    const ac = findAmountColumn(cells);
    const cc = findColumn(cells, CREDIT_HEADERS);
    const dbc = findColumn(cells, DEBIT_HEADERS);
    const dc = findColumn(cells, DATE_HEADERS);
    const dsc = findColumn(cells, DESC_HEADERS);
    if ((ac !== -1 || (cc !== -1 && dbc !== -1)) && (dc !== -1 || dsc !== -1)) {
      headerIdx = i;
      delimiter = d;
      amountCol = ac;
      creditCol = cc;
      debitCol = dbc;
      dateCol = dc;
      descCol = dsc;
      transCol = findColumn(cells, TRANSACTION_HEADERS);
      dcCol = cells.findIndex((h, idx) => idx !== dsc && idx !== transCol && DC_HEADERS.some((n) => h === n || h.startsWith(n)));
      break;
    }
  }

  // Sem cabeçalho reconhecível: assume ordem comum (data, descrição, valor) desde a 1ª linha.
  if (headerIdx === -1) {
    dateCol = 0;
    descCol = 1;
    amountCol = 2;
  }

  const dataLines = headerIdx === -1 ? lines : lines.slice(headerIdx + 1);
  const transactions: ParsedTransaction[] = [];
  for (const line of dataLines) {
    const cols = splitCsvLine(line, delimiter);
    let amount: number;
    if (creditCol !== -1 && debitCol !== -1 && (amountCol === -1 || headerIdx !== -1)) {
      // Duas colunas: o que está em crédito entra, o que está em débito sai.
      const credit = Math.abs(parseAmountFlexible(cols[creditCol] ?? "")) || 0;
      const debit = Math.abs(parseAmountFlexible(cols[debitCol] ?? "")) || 0;
      amount = credit - debit;
      if (amount === 0 && amountCol !== -1) amount = parseAmountFlexible(cols[amountCol] ?? "");
    } else {
      amount = parseAmountFlexible(cols[amountCol] ?? "");
    }
    if (dcCol !== -1 && amount > 0 && /^d\b|^d[eé]b/i.test((cols[dcCol] ?? "").trim())) amount = -amount;
    if (Number.isNaN(amount) || amount === 0) continue;

    const desc = (cols[descCol] ?? "").trim();
    const trans = transCol !== -1 ? (cols[transCol] ?? "").trim() : "";
    // Pula saldos/totais, são fotografias do saldo, não transações.
    if (NON_TRANSACTION_RE.test(desc) || NON_TRANSACTION_RE.test(trans)) continue;

    // Descrição rica: junta "Transação" + "Descrição" quando as duas existem e diferem.
    const description =
      [trans, desc].filter((s) => s && s !== "-").filter((s, i, arr) => arr.indexOf(s) === i).join(" · ") ||
      "Lançamento";

    transactions.push({ date: normalizeDate(cols[dateCol] ?? ""), description, amount });
  }
  return transactions;
}

/** Palavras que indicam entrada (crédito) numa linha de extrato sem coluna de débito/crédito. */
const CREDIT_HINTS = /\b(sal[aá]rio|rendimento|dep[oó]sito|cr[eé]dito|recebid[oa]|estorno|reembolso|proventos)\b/i;

/**
 * Parser de texto solto, usado pra PDF, cujo texto extraído não é delimitado como CSV. Em cada
 * linha procura uma data e um valor monetário (formato BR); o resto vira a descrição. Sinal:
 * "-" explícito ou coluna "D" = saída; palavra de crédito/entrada = entrada; senão, assume saída
 * (a maioria das linhas é gasto), o usuário revisa depois.
 */
const MONTH_ABBR: Record<string, string> = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };
/** Linhas que são saldo/total, não movimento. */
const BALANCE_LINE_RE = /\b(saldo|total\s+(da|desta|de|a\s+pagar)|subtotal|limite)\b/i;

/**
 * Data no COMEÇO de uma linha de PDF: "12/08/2026", "12/08", "12 AGO", "12 ago 2026",
 * "2026-08-12". Sem ano, usa o de referência (fatura escolhida ou o atual).
 */
function leadingDate(line: string, refYear: number): { iso: string; length: number } | null {
  const t = line.trimStart();
  const pad = (n: string) => n.padStart(2, "0");
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { iso: `${m[3]}-${m[2]}-${m[1]}`, length: m[0].length };
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, length: m[0].length };
  m = t.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s+(\d{4}))?/i);
  if (m) return { iso: `${m[3] ?? refYear}-${MONTH_ABBR[m[2].toLowerCase()]}-${pad(m[1])}`, length: m[0].length };
  m = t.match(/^(\d{2})\/(\d{2})(?![\d/])/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { iso: `${refYear}-${m[2]}-${m[1]}`, length: m[0].length };
  return null;
}

/**
 * Parser de texto solto (PDF). Um lançamento COMEÇA numa linha com data e termina na primeira
 * linha que traz um valor: pode ser a mesma linha ("12/08 IFOOD 45,90") ou a descrição pode
 * descer por uma ou duas linhas antes do valor (Inter, C6, Itaú). Linhas de saldo/total não
 * contam. Sinal: "-" explícito ou "D" = saída; palavra de crédito ou "C" = entrada; senão saída.
 */
export function parseTextLines(content: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const lines = content.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];
  const moneyRe = /-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g;
  const anyDateRe = /(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/;

  let open: { date: string; parts: string[]; lines: number } | null = null;

  const flush = (rawAmount: string, lineForSign: string) => {
    if (!open) return;
    const magnitude = Math.abs(parseBrazilianNumber(rawAmount));
    const text = open.parts.join(" ").replace(/\s+/g, " ").trim();
    if (!Number.isNaN(magnitude) && magnitude > 0 && !BALANCE_LINE_RE.test(text)) {
      const isNegative = /-/.test(rawAmount) || /\bD\b\s*$/.test(lineForSign);
      const isCredit = !isNegative && (CREDIT_HINTS.test(text) || /\bC\b\s*$/.test(lineForSign));
      transactions.push({ date: open.date, description: text.replace(/\b[DC]\b\s*$/, "").trim() || "Lançamento", amount: isCredit ? magnitude : -magnitude });
    }
    open = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const lead = leadingDate(line, refYear);
    const inlineDate = lead ? null : line.match(anyDateRe);
    if (lead || inlineDate) {
      // Nova data = novo lançamento; o anterior sem valor é descartado (era cabeçalho/saldo).
      open = { date: lead ? lead.iso : normalizeDate(inlineDate![0]), parts: [], lines: 0 };
      const rest = lead ? line.slice(line.length - line.trimStart().length + lead.length) : line.replace(inlineDate![0], " ");
      const moneys = rest.match(moneyRe);
      if (moneys && moneys.length > 0) {
        const rawAmount = moneys[moneys.length - 1];
        open.parts.push(rest.replace(moneyRe, " "));
        flush(rawAmount, rest);
      } else {
        open.parts.push(rest);
      }
      continue;
    }
    if (!open) continue;
    open.lines += 1;
    const moneys = line.match(moneyRe);
    if (moneys && moneys.length > 0) {
      open.parts.push(line.replace(moneyRe, " "));
      flush(moneys[moneys.length - 1], line);
    } else if (open.lines <= 3) {
      open.parts.push(line);
    } else {
      open = null;
    }
  }
  return transactions;
}

/** `source` "pdf" força os parsers de texto (o do Nubank primeiro, depois o genérico por
 * linha); caso contrário detecta OFX vs CSV. */
export function parseStatement(content: string, source: "auto" | "pdf" = "auto", refYear?: number): ParsedTransaction[] {
  if (source === "pdf") {
    if (isNubankStatement(content)) {
      const nubank = parseNubankStatement(content);
      if (nubank.length > 0) return nubank;
    }
    return parseTextLines(content, refYear);
  }
  return isOfx(content) ? parseOfx(content) : parseCsv(content);
}
