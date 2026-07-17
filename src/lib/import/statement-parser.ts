/**
 * Parser de extrato bancário (item 3 da Rodada 2). Suporta OFX e CSV — os dois formatos de
 * exportação mais comuns dos bancos brasileiros. PDF não é suportado aqui (exige extração de
 * texto binário, fora do escopo sem lib dedicada); o usuário é orientado a exportar CSV/OFX.
 *
 * Convenção de sinal em `amount`: negativo = saída (vira EXPENSE), positivo = entrada (INCOME).
 */

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
 * Valor monetário em formato BR ("1.234,56") OU americano ("1,234.56", "87.53") — decide pelo
 * último separador. Bancos como o BTG exportam o extrato no formato americano; sem isso,
 * "-14,097.44" (14 mil) seria lido como 14,09.
 */
export function parseAmountFlexible(raw: string): number {
  const t = raw.replace(/[R$\s]/gi, "").trim();
  if (t === "" || t === "-") return NaN;
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
  // OFX "SGML" não fecha as tags — o valor vai até a próxima tag ou fim de linha.
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
/** Coluna separada de "Transação"/"Tipo" (ex.: extrato BTG) — enriquece a descrição. */
const TRANSACTION_HEADERS = ["transa", "tipo de lanç", "tipo"];
/** Linhas que NÃO são transações (saldo diário/atual/anterior, totais) — não viram lançamento. */
const NON_TRANSACTION_RE = /\bsaldo\b/i;

function findColumn(headers: string[], needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

export function parseCsv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Procura a linha de CABEÇALHO — bancos (BTG etc.) põem metadados (cliente, conta, período)
  // antes dela. O cabeçalho é a 1ª linha que tenha coluna de valor + de data ou descrição.
  let headerIdx = -1;
  let delimiter = detectDelimiter(lines[0]);
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let transCol = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const d = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], d).map((h) => h.toLowerCase());
    const ac = findColumn(cells, AMOUNT_HEADERS);
    const dc = findColumn(cells, DATE_HEADERS);
    const dsc = findColumn(cells, DESC_HEADERS);
    if (ac !== -1 && (dc !== -1 || dsc !== -1)) {
      headerIdx = i;
      delimiter = d;
      amountCol = ac;
      dateCol = dc;
      descCol = dsc;
      transCol = findColumn(cells, TRANSACTION_HEADERS);
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
    const amount = parseAmountFlexible(cols[amountCol] ?? "");
    if (Number.isNaN(amount) || amount === 0) continue;

    const desc = (cols[descCol] ?? "").trim();
    const trans = transCol !== -1 ? (cols[transCol] ?? "").trim() : "";
    // Pula saldos/totais — são fotografias do saldo, não transações.
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
 * Parser de texto solto — usado pra PDF, cujo texto extraído não é delimitado como CSV. Em cada
 * linha procura uma data e um valor monetário (formato BR); o resto vira a descrição. Sinal:
 * "-" explícito ou coluna "D" = saída; palavra de crédito/entrada = entrada; senão, assume saída
 * (a maioria das linhas é gasto) — o usuário revisa depois.
 */
export function parseTextLines(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];
  const dateRe = /(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/;
  const moneyRe = /-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}/g;

  for (const line of lines) {
    const dateMatch = line.match(dateRe);
    if (!dateMatch) continue;
    const moneyMatches = line.match(moneyRe);
    if (!moneyMatches || moneyMatches.length === 0) continue;

    const rawAmount = moneyMatches[moneyMatches.length - 1];
    const magnitude = Math.abs(parseBrazilianNumber(rawAmount));
    if (Number.isNaN(magnitude) || magnitude === 0) continue;

    const isNegative = /-/.test(rawAmount) || /\bD\b\s*$/.test(line);
    const isCredit = !isNegative && (CREDIT_HINTS.test(line) || /\bC\b\s*$/.test(line));
    const amount = isCredit ? magnitude : -magnitude;

    const description =
      line
        .replace(dateMatch[0], " ")
        .replace(moneyRe, " ")
        .replace(/\b[DC]\b\s*$/, " ")
        .replace(/\s+/g, " ")
        .trim() || "Lançamento";

    transactions.push({ date: normalizeDate(dateMatch[0]), description, amount });
  }
  return transactions;
}

/** `source` "pdf" força o parser de linhas de texto; caso contrário detecta OFX vs CSV. */
export function parseStatement(content: string, source: "auto" | "pdf" = "auto"): ParsedTransaction[] {
  if (source === "pdf") return parseTextLines(content);
  return isOfx(content) ? parseOfx(content) : parseCsv(content);
}
