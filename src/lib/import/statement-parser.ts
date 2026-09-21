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
/** "R$" sozinho é o nome da coluna de valor na fatura do Santander em Excel. */
const AMOUNT_HEADERS = ["valor", "amount", "montante", "quantia", "value", "r$", "reais"];
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

/** Igual, mas ignorando uma coluna já usada: "Data Lançamento" casa com data E com descrição,
 * e sem isto a coluna "Histórico" ao lado era ignorada. */
function findColumnExcept(headers: string[], needles: string[], skip: number): number {
  return headers.findIndex((h, i) => i !== skip && needles.some((n) => h.includes(n)));
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

/** Onde ficam as colunas de uma tabela, descoberto a partir de uma linha de cabeçalho. */
type CsvLayout = {
  delimiter: string;
  dateCol: number;
  descCol: number;
  amountCol: number;
  transCol: number;
  creditCol: number;
  debitCol: number;
  dcCol: number;
};

/** Tem valor em dinheiro na linha? Cabeçalho não tem; linha de lançamento tem. */
const MONEY_IN_LINE_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d+\.\d{2}\b/;
/** Célula que começa com data ("28/07", "28/07/2026", "2026-07-28"): é lançamento, não cabeçalho. */
const CELL_STARTS_WITH_DATE_RE = /^\s*(?:\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/;

/**
 * Lê uma linha COMO cabeçalho de tabela, ou devolve null se ela não for um.
 * Cabeçalho = tem coluna de valor (ou o par crédito+débito) mais uma de data ou descrição, e
 * nenhum valor em dinheiro — senão um lançamento cuja descrição por acaso diz "PAGTO VALOR"
 * se passaria por cabeçalho e bagunçaria o resto do arquivo.
 */
function readHeaderLayout(line: string): CsvLayout | null {
  if (MONEY_IN_LINE_RE.test(line)) return null;
  const delimiter = detectDelimiter(line);
  const cells = splitCsvLine(line, delimiter).map((h) => h.toLowerCase());
  // Nenhum cabeçalho começa uma célula com data. Faz falta porque nem todo valor tem centavos
  // ("250"), e aí a checagem de dinheiro acima deixa a linha de compra passar por cabeçalho.
  if (cells.some((c) => CELL_STARTS_WITH_DATE_RE.test(c))) return null;
  const amountCol = findAmountColumn(cells);
  const creditCol = findColumn(cells, CREDIT_HEADERS);
  const debitCol = findColumn(cells, DEBIT_HEADERS);
  const dateCol = findColumn(cells, DATE_HEADERS);
  // "DATA DESCRICAO" numa célula só é o cabeçalho da fatura do Santander: a data e a descrição
  // vêm grudadas. Só aceitamos essa coincidência quando não existe outra coluna de descrição.
  const descCol = findColumnExcept(cells, DESC_HEADERS, dateCol) !== -1
    ? findColumnExcept(cells, DESC_HEADERS, dateCol)
    : findColumn(cells, DESC_HEADERS);
  if (amountCol === -1 && !(creditCol !== -1 && debitCol !== -1)) return null;
  if (dateCol === -1 && descCol === -1) return null;
  const transCol = findColumn(cells, TRANSACTION_HEADERS);
  const dcCol = cells.findIndex(
    (h, idx) => idx !== descCol && idx !== transCol && DC_HEADERS.some((n) => h === n || h.startsWith(n)),
  );
  return { delimiter, dateCol, descCol, amountCol, transCol, creditCol, debitCol, dcCol };
}

/**
 * Fatura do Santander em Excel: a data e a descrição vêm na MESMA célula
 * ("28/07  MERCADO BOM PRECO - 02/02"). Sem separar as duas, a data virava texto solto e o
 * lançamento inteiro era descartado — 13 compras no arquivo, nenhuma lida.
 */
function splitDateFromDescription(cell: string, refYear: number): { date: string; description: string } {
  const lead = leadingDate(cell, refYear);
  if (!lead) return { date: normalizeDate(cell), description: cell.trim() };
  return { date: lead.iso, description: cell.trimStart().slice(lead.length).trim() };
}

/** Uma linha de dados lida com as colunas do cabeçalho vigente; null quando não é lançamento. */
function readTransactionLine(line: string, layout: CsvLayout, refYear: number): ParsedTransaction | null {
  const { delimiter, dateCol, descCol, amountCol, transCol, creditCol, debitCol, dcCol } = layout;
  const cols = splitCsvLine(line, delimiter);

  let amount: number;
  if (creditCol !== -1 && debitCol !== -1) {
    // Duas colunas: o que está em crédito entra, o que está em débito sai.
    const credit = Math.abs(parseAmountFlexible(cols[creditCol] ?? "")) || 0;
    const debit = Math.abs(parseAmountFlexible(cols[debitCol] ?? "")) || 0;
    amount = credit - debit;
    if (amount === 0 && amountCol !== -1) amount = parseAmountFlexible(cols[amountCol] ?? "");
  } else {
    amount = parseAmountFlexible(cols[amountCol] ?? "");
  }
  if (dcCol !== -1 && amount > 0 && /^d\b|^d[eé]b/i.test((cols[dcCol] ?? "").trim())) amount = -amount;
  if (Number.isNaN(amount) || amount === 0) return null;

  const juntas = dateCol !== -1 && dateCol === descCol ? splitDateFromDescription(cols[dateCol] ?? "", refYear) : null;
  const desc = (juntas ? juntas.description : (cols[descCol] ?? "")).trim();
  const trans = transCol !== -1 ? (cols[transCol] ?? "").trim() : "";
  // Pula saldos/totais, são fotografias do saldo, não transações.
  if (NON_TRANSACTION_RE.test(desc) || NON_TRANSACTION_RE.test(trans)) return null;

  // Descrição rica: junta "Transação" + "Descrição" quando as duas existem e diferem.
  const description =
    [trans, desc].filter((s) => s && s !== "-").filter((s, i, arr) => arr.indexOf(s) === i).join(" · ") ||
    "Lançamento";

  return { date: juntas ? juntas.date : normalizeDate(cols[dateCol] ?? ""), description, amount };
}

/**
 * Arquivo sem NENHUMA linha de cabeçalho: descobre as colunas pelo formato das linhas. O
 * padrão é (data, descrição, valor); a fatura do Santander em Excel tem só duas colunas, com a
 * data colada na descrição na primeira. Antes a gente chutava sempre três colunas e o valor era
 * procurado numa coluna que não existia, então o arquivo inteiro virava zero lançamentos.
 */
function guessLayoutFromRows(lines: string[], refYear: number): CsvLayout {
  const delimiter = detectDelimiter(lines[0]);
  const base = { delimiter, transCol: -1, creditCol: -1, debitCol: -1, dcCol: -1 };
  // "Duas colunas" só vale se TODA linha for assim: data colada na descrição de um lado,
  // número do outro. Nem todo valor tem centavos ("250"), então não dá pra filtrar por centavos.
  const amostra = lines.slice(0, 20);
  const duasColunas =
    amostra.length > 0 &&
    amostra.every((l) => {
      const cols = splitCsvLine(l, delimiter);
      return cols.length === 2 && leadingDate(cols[0], refYear) !== null && Number.isFinite(parseAmountFlexible(cols[1]));
    });
  if (duasColunas) return { ...base, dateCol: 0, descCol: 0, amountCol: 1 };
  return { ...base, dateCol: 0, descCol: 1, amountCol: 2 };
}

export function parseCsv(content: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Excel de banco vem com VÁRIAS ABAS coladas uma na outra (fatura nacional, internacional,
  // parcelas) e cada aba traz o seu próprio cabeçalho, com as colunas em posições diferentes.
  // Antes a gente travava as colunas no primeiro cabeçalho e lia o arquivo inteiro com elas:
  // da segunda aba em diante o valor caía numa coluna errada e a linha ia pro lixo em silêncio.
  // Era a "leitura parcial" do diagnóstico — a pessoa via um punhado de lançamentos e achava
  // que o app tinha perdido o resto da fatura. Agora cada cabeçalho novo reposiciona as colunas
  // dali pra frente. A procura também não para mais na 40ª linha: fatura costuma vir com carta
  // e resumo antes da tabela, e a tabela de verdade ficava fora do alcance.
  const transactions: ParsedTransaction[] = [];
  let layout: CsvLayout | null = null;
  for (const line of lines) {
    const header = readHeaderLayout(line);
    if (header) {
      layout = header;
      continue;
    }
    // Ainda no preâmbulo (nome, conta, período): nada pra ler antes da primeira tabela.
    if (!layout) continue;
    const transaction = readTransactionLine(line, layout, refYear);
    if (transaction) transactions.push(transaction);
  }
  if (layout !== null) return transactions;

  // Nenhum cabeçalho no arquivo inteiro: as colunas saem do formato das próprias linhas.
  const semCabecalho = guessLayoutFromRows(lines, refYear);
  for (const line of lines) {
    const transaction = readTransactionLine(line, semCabecalho, refYear);
    if (transaction) transactions.push(transaction);
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
/**
 * Extrato e fatura falam do PASSADO. Uma data sem ano ("31/12", "12 DEZ") resolvida com o ano
 * corrente joga o lançamento no futuro quando o arquivo atravessa a virada: em 05/01/2027,
 * o extrato de dezembro virava 31/12/2027 e sumia da vista. Mais de ~45 dias à frente de hoje
 * só pode ser o ano passado.
 */
function backdateIfFuture(iso: string, today: Date): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const limit = new Date(today.getTime() + 45 * 86_400_000);
  if (d <= limit) return iso;
  return `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
}

function leadingDate(line: string, refYear: number): { iso: string; length: number } | null {
  const t = line.trimStart();
  const pad = (n: string) => n.padStart(2, "0");
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { iso: `${m[3]}-${m[2]}-${m[1]}`, length: m[0].length };
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, length: m[0].length };
  m = t.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s+(\d{4}))?/i);
  if (m) {
    const iso = `${m[3] ?? refYear}-${MONTH_ABBR[m[2].toLowerCase()]}-${pad(m[1])}`;
    return { iso: m[3] ? iso : backdateIfFuture(iso, new Date()), length: m[0].length };
  }
  m = t.match(/^(\d{2})\/(\d{2})(?![\d/])/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { iso: backdateIfFuture(`${refYear}-${m[2]}-${m[1]}`, new Date()), length: m[0].length };
  }
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
  return isOfx(content) ? parseOfx(content) : parseCsv(content, refYear);
}
