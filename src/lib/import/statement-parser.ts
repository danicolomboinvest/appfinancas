/**
 * Parser de extrato bancário (item 3 da Rodada 2). Suporta OFX e CSV, os dois formatos de
 * exportação mais comuns dos bancos brasileiros. PDF não é suportado aqui (exige extração de
 * texto binário, fora do escopo sem lib dedicada); o usuário é orientado a exportar CSV/OFX.
 *
 * Convenção de sinal em `amount`: negativo = saída (vira EXPENSE), positivo = entrada (INCOME).
 */

import { isBanestesStatement, parseBanestesStatement } from "./banestes-pdf";
import { isBancoDoBrasilStatement, parseBancoDoBrasilStatement } from "./bb-pdf";
import { isBradescoStatement, parseBradescoStatement } from "./bradesco-pdf";
import { isBradescoInvoice, parseBradescoInvoice } from "./bradesco-fatura-pdf";
import { fechaComoFatura, lerFaturaTestando } from "./leitor-inteligente";
import { isMercadoPagoStatement, parseMercadoPagoStatement } from "./mercado-pago-pdf";
import { isCaixaAppStatement, parseCaixaAppStatement } from "./caixa-pdf";
import { isCoraStatement, parseCoraStatement } from "./cora-pdf";
import { isInterInvoice, isInterStatement, parseInterInvoice, parseInterStatement } from "./inter-pdf";
import { isNubankStatement, parseNubankStatement } from "./nubank-pdf";
import { isOurocardInvoice, parseOurocardInvoice } from "./ourocard-pdf";
import { isItauInvoice, parseItauInvoice } from "./itau-fatura-pdf";
import { isMidwayInvoice, parseMidwayInvoice } from "./midway-fatura-pdf";
import { isC6Invoice, parseC6Invoice } from "./c6-fatura-pdf";
import { isSantanderInvoice, parseSantanderInvoice } from "./santander-fatura-pdf";
import { isNubankInvoice, parseNubankInvoice } from "./nubank-fatura-pdf";
import { isSantanderConsolidatedStatement, parseSantanderConsolidatedStatement } from "./santander-pdf";

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
  // "50,00-": exportação contábil (SAP e afins) põe o menos DEPOIS do número. Sem isto o
  // Number("50.00-") dava NaN e a saída era jogada fora calada.
  if (/\d-$/.test(t)) {
    negativeByMark = true;
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

/**
 * Normaliza data para ISO (YYYY-MM-DD). Aceita DD/MM/YYYY, D/M/AA, YYYY-MM-DD e YYYYMMDD (OFX).
 *
 * O dia/mês com um dígito e o ano com dois ("1/07/26") vêm do extrato do Banco Inter. Antes a
 * data voltava do jeito que chegou, e na hora de gravar, sem ano/mês legível, TODO lançamento
 * caía no mês corrente: o extrato de julho importado em setembro inflava setembro inteiro.
 */
export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // Aceita "DD/MM/YYYY" e também "DD/MM/YYYY HH:MM" (extrato BTG traz data e hora juntas).
  // "02-08-2026" (Mercado Pago) e "02.08.2026" também: sem isso a data não era entendida e o
  // extrato de agosto inteiro caía no mês de hoje.
  const br = trimmed.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?!\d)/);
  if (br) {
    const ano = br[4].length === 2 ? `20${br[4]}` : br[4];
    // "31/02" passava (dia até 31 em qualquer mês) e na gravação o new Date rolava pra 3 de
    // março: o gasto mudava de mês calado. Dia que o mês não tem não é data.
    if (diaExiste(Number(ano), Number(br[3]), Number(br[1]))) return `${ano}-${br[3].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ofx = trimmed.match(/^(\d{4})(\d{2})(\d{2})/); // OFX DTPOSTED: YYYYMMDD[HHMMSS]
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  return trimmed;
}

/** Data ISO de um ano que faz sentido pra um extrato (nem "ano 2", nem "ano 9999"). */
function dataPlausivel(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const ano = Number(m[1]);
  return ano >= 1990 && ano <= new Date().getFullYear() + 5 && diaExiste(ano, Number(m[2]), Number(m[3]));
}

/** O dia existe nesse mês? (31/02 não, 29/02 só no ano bissexto.) */
function diaExiste(ano: number, mes: number, dia: number): boolean {
  if (!(mes >= 1 && mes <= 12 && dia >= 1)) return false;
  return dia <= new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function isOfx(content: string): boolean {
  return /<STMTTRN>|<OFX>/i.test(content);
}

function tag(block: string, name: string): string | null {
  // OFX "SGML" não fecha as tags, o valor vai até a próxima tag ou fim de linha.
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : null;
}

/** "&amp;", "&lt;", "&#231;": o OFX escapa como XML, e a descrição mostrava "P&amp;B LTDA". */
function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (whole, ent: string) => {
    const e = ent.toLowerCase();
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/**
 * Valor do OFX. O padrão manda ponto decimal ("-1234.56"); aí o ponto É o decimal, mesmo com
 * três casas. Com vírgula, é banco que escreveu do seu jeito: "-10,00" (BR) ou "-1,234.56"
 * (milhar americano), e quem decide é o último separador. Antes a vírgula era sempre decimal
 * e R$ 1.234,56 virava R$ 1,23.
 */
function parseOfxAmount(raw: string): number {
  const t = raw.replace(/[R$\s]/gi, "");
  if (t === "") return NaN;
  return t.includes(",") ? parseAmountFlexible(t) : Number(t);
}

export function parseOfx(content: string): ParsedTransaction[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: ParsedTransaction[] = [];
  for (const block of blocks) {
    const amountRaw = tag(block, "TRNAMT");
    if (amountRaw === null) continue;
    const amount = parseOfxAmount(amountRaw);
    if (Number.isNaN(amount)) continue;
    // `||`, não `??`: MEMO vazio ("<MEMO>" sem nada) vem como "", e o NAME ficava de fora.
    const description = decodeEntities(tag(block, "MEMO") || tag(block, "NAME") || "").trim() || "Lançamento";
    const dtposted = tag(block, "DTPOSTED");
    const date = normalizeDate(dtposted ?? "");
    // Data impossível ("00000000"): não é movimento, é linha de saldo que o banco põe no OFX.
    // Em 21/09/2026 sete delas entraram como R$ 19,6 mil de renda no "ano 2", e a conta "do
    // primeiro mês até hoje" passou a percorrer 24 mil meses.
    if (dtposted && /^\d{8}/.test(dtposted) && !dataPlausivel(date)) continue;
    transactions.push({ date, description, amount });
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
const DC_HEADERS = ["d/c", "c/d", "natureza", "tipo"];
/**
 * Célula de sinal que diz SAÍDA: "D", "Débito", "Saída", "Debit". Antes só "D"/"Déb" contavam, e
 * no CSV com "Saída"/"Entrada" o gasto entrava como renda.
 */
const SINAL_SAIDA_RE = /^(?:d\b|d[eé]b|sa[ií]da|debit|-$)/i;
/** Célula que é SÓ o sinal (nada de "Pix enviado"): essa não enriquece a descrição. */
const CELULA_SO_SINAL_RE = /^(?:d|c|d[eé]b(?:ito)?|cr[eé]d(?:ito)?|sa[ií]da|entrada|debit|credit|[+-])$/i;
/** Coluna separada de "Transação"/"Tipo" (ex.: extrato BTG), enriquece a descrição. */
const TRANSACTION_HEADERS = ["transa", "tipo de lanç", "tipo"];
/** Célula que é SÓ uma data: no Inter a coluna "TRANSACAO" traz a data, não o tipo. */
const CELL_IS_DATE_RE = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$|^\d{4}-\d{2}-\d{2}$/;
/**
 * Linhas que NÃO são transações (saldo diário/atual/anterior), não viram lançamento. Só quando
 * a descrição COMEÇA com "saldo" ou diz que tipo de saldo é: antes bastava citar a palavra, e
 * um Pix de verdade ("Quitação saldo devedor") sumia calado.
 */
const NON_TRANSACTION_RE =
  /^[^a-z0-9]*saldo\b|\bsaldo\s+(?:do\s+dia|anterior|atual|final|inicial|dispon[ií]vel|bloqueado|em\s+c|total|parcial|de\s+abertura|l[ií]quido)\b/i;

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
  const ehColunaDeSinal = (h: string, idx: number) => idx !== descCol && DC_HEADERS.some((n) => h === n || h.startsWith(n));
  // Uma coluna só pra sinal ("D/C", "Natureza") vence. Sem ela, a coluna "Tipo" faz os dois
  // papéis: quando a célula é D/C/Saída/Entrada ela dá o sinal, quando é "Pix enviado" ela
  // enriquece a descrição (extrato BTG). Antes "Tipo" era só descrição: "Mercado;45,90;D" entrava
  // como RENDA de R$ 45,90 com a descrição "D · Mercado".
  let dcCol = cells.findIndex((h, idx) => idx !== transCol && ehColunaDeSinal(h, idx));
  if (dcCol === -1 && transCol !== -1 && ehColunaDeSinal(cells[transCol], transCol)) dcCol = transCol;
  // "Entrada/Saída" ou "Débito/Crédito" numa célula só: é a coluna do sinal, não um par de
  // colunas de crédito e débito (as duas apontavam pra ela, a conta dava zero e o sinal sumia).
  if (creditCol !== -1 && creditCol === debitCol && amountCol !== -1) {
    if (dcCol === -1) dcCol = creditCol;
    return { delimiter, dateCol, descCol, amountCol, transCol, creditCol: -1, debitCol: -1, dcCol };
  }
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
  const sinalCelula = dcCol !== -1 ? (cols[dcCol] ?? "").trim() : "";
  if (amount > 0 && SINAL_SAIDA_RE.test(sinalCelula)) amount = -amount;
  if (Number.isNaN(amount) || amount === 0) return null;

  const juntas = dateCol !== -1 && dateCol === descCol ? splitDateFromDescription(cols[dateCol] ?? "", refYear) : null;
  const desc = (juntas ? juntas.description : (cols[descCol] ?? "")).trim();
  // Data repetida na coluna de "Transação" não enriquece nada: virava "1/07/26 · PAGAMENTO…".
  const transRaw = transCol !== -1 ? (cols[transCol] ?? "").trim() : "";
  // A coluna "Tipo" que só traz D/C/Saída/Entrada já deu o sinal: não vira "D · Mercado".
  const trans = CELL_IS_DATE_RE.test(transRaw) || CELULA_SO_SINAL_RE.test(transRaw) ? "" : transRaw;
  // Pula saldos/totais, são fotografias do saldo, não transações.
  if (NON_TRANSACTION_RE.test(desc) || NON_TRANSACTION_RE.test(trans)) return null;

  // Descrição rica: junta "Transação" + "Descrição" quando as duas existem e diferem.
  const description =
    [trans, desc].filter((s) => s && s !== "-").filter((s, i, arr) => arr.indexOf(s) === i).join(" · ") ||
    "Lançamento";

  return { date: juntas ? juntas.date : csvDate(cols[dateCol] ?? "", refYear), description, amount };
}

/**
 * Data da coluna de data do CSV. "10/08" sem ano ficava crua e, na gravação, caía no MÊS ATUAL:
 * o gasto de agosto aparecia em setembro. Usa o ano de referência (fatura escolhida ou o atual),
 * do mesmo jeito que o texto de PDF já fazia, recuando um ano se cair no futuro.
 */
function csvDate(cell: string, refYear: number): string {
  const iso = normalizeDate(cell);
  const semAno = cell.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!semAno || !diaExiste(refYear, Number(semAno[2]), Number(semAno[1]))) return iso;
  return backdateIfFuture(`${refYear}-${semAno[2].padStart(2, "0")}-${semAno[1].padStart(2, "0")}`, new Date());
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

/**
 * Planilha em que os lançamentos têm data: linha SEM data não é lançamento. É o quadro do fim do
 * extrato do Itaú ("LIMITE DA CONTA TOTAL 15.500", "JUROS DO LIMITE"), que sem data caía no mês
 * de hoje — o limite do cheque especial entrava como R$ 15.500 de renda.
 */
function semLinhaSemData(txns: ParsedTransaction[]): ParsedTransaction[] {
  const comData = txns.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date));
  return comData.length >= 3 && comData.length > txns.length / 2 ? comData : txns;
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
  if (layout !== null) return semLinhaSemData(transactions);

  // Nenhum cabeçalho no arquivo inteiro: as colunas saem do formato das próprias linhas.
  const semCabecalho = guessLayoutFromRows(lines, refYear);
  for (const line of lines) {
    const transaction = readTransactionLine(line, semCabecalho, refYear);
    if (transaction) transactions.push(transaction);
  }
  return semLinhaSemData(transactions);
}

/** Palavras que indicam entrada (crédito) numa linha de extrato sem coluna de débito/crédito. */
const CREDIT_HINTS = /\b(sal[aá]rio|rendimento|dep[oó]sito|cr[eé]dito|recebid[oa]|estorno|reembolso|proventos)\b/i;
/**
 * "Crédito" que é o PRODUTO, não o sentido do dinheiro: pagar o cartão de crédito ou a parcela
 * do crédito pessoal é saída. Antes a palavra sozinha virava entrada, e como renda o pagamento
 * da fatura nem chegava em parecePagamentoDeFatura (que só olha gasto).
 */
const CREDITO_QUE_E_SAIDA_RE =
  /cart[aã]o\s+(?:de\s+)?cr[eé]dito|cr[eé]dito\s+(?:pessoal|consignado|rotativo|imobili[aá]rio|parcelado)|\b(?:pagamento|pagto|pgto|parcela|presta[cç][aã]o)\b.*\bcr[eé]dito/i;

/** A linha tem palavra de entrada? "Crédito" só conta quando não é o nome do produto. */
function temPalavraDeEntrada(text: string): boolean {
  if (!CREDIT_HINTS.test(text)) return false;
  if (!CREDITO_QUE_E_SAIDA_RE.test(text)) return true;
  // Tirando o "crédito" do produto, sobra outra palavra de entrada ("ESTORNO ... CARTAO DE CREDITO")?
  return CREDIT_HINTS.test(text.replace(/cr[eé]dito/gi, " "));
}

/**
 * Parser de texto solto, usado pra PDF, cujo texto extraído não é delimitado como CSV. Em cada
 * linha procura uma data e um valor monetário (formato BR); o resto vira a descrição. O sinal
 * é decidido em `parseTextLines`, olhando o arquivo inteiro (saldo corrido, "-", C/D, palavras).
 */
const MONTH_ABBR: Record<string, string> = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };
/** Linhas que são saldo/total, não movimento. */
const BALANCE_LINE_RE = /\b(saldo|total\s+(da|desta|de|a\s+pagar)|subtotal|limite|hist[óo]rico\s+de\s+faturas)\b/i;

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

/**
 * Na fatura do Santander, parte das compras vem com um algarismo solto ANTES da data
 * ("2 \t05/11 AMAZON PRIME BR \t11/12 \t13,90"). Sem tirar esse algarismo a data não era
 * reconhecida e a compra sumia: 14 de 37 compras de uma fatura ficaram de fora.
 */
const MARCADOR_ANTES_DA_DATA_RE = /^[1-9]\s+(?=\d{2}\/\d{2}(?![\d/])\s+\S)/;

function leadingDate(line: string, refYear: number): { iso: string; length: number } | null {
  const semMarcador = line.trimStart();
  const marcador = semMarcador.match(MARCADOR_ANTES_DA_DATA_RE);
  const t = marcador ? semMarcador.slice(marcador[0].length) : semMarcador;
  const found = leadingDateCore(t, refYear);
  return found && marcador ? { iso: found.iso, length: found.length + marcador[0].length } : found;
}

function leadingDateCore(t: string, refYear: number): { iso: string; length: number } | null {
  const pad = (n: string) => n.padStart(2, "0");
  let m = t.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return { iso: `${m[3]}-${m[2]}-${m[1]}`, length: m[0].length };
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, length: m[0].length };
  // O mês é a abreviação OU o nome inteiro, e nada colado depois: "2 MAIONESE" (quantidade +
  // item na nota) era lido como "2 de MAIo", virava lançamento de maio e a compra de cima
  // ficava sem valor.
  m = t.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:eiro|ereiro|[cç]o|il|o|ho|sto|embro|ubro)?\.?(?![A-Za-zÀ-ÿ])(?:\s+(\d{4}))?/i);
  if (m) {
    const iso = `${m[3] ?? refYear}-${MONTH_ABBR[m[2].toLowerCase()]}-${pad(m[1])}`;
    return { iso: m[3] ? iso : backdateIfFuture(iso, new Date()), length: m[0].length };
  }
  // "21/out", "04/ago", "21/outubro/2026": a fatura de cartão escreve o mês por nome, com barra.
  // O rabicho do mês por extenso só é aceito em minúsculas de propósito — em "04/agoESPACO LASER"
  // (fatura sem espaço entre a data e a loja) as maiúsculas são a descrição, não o mês.
  m = t.match(/^(\d{1,2})\/([A-Za-z]{3})([a-zç]*)\.?(?:\/(\d{2,4}))?/);
  if (m && MONTH_ABBR[m[2].toLowerCase()]) {
    const ano = m[4] ? (m[4].length === 2 ? `20${m[4]}` : m[4]) : String(refYear);
    const iso = `${ano}-${MONTH_ABBR[m[2].toLowerCase()]}-${pad(m[1])}`;
    return { iso: m[4] ? iso : backdateIfFuture(iso, new Date()), length: m[0].length };
  }
  m = t.match(/^(\d{2})\/(\d{2})(?![\d/])/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { iso: backdateIfFuture(`${refYear}-${m[2]}-${m[1]}`, new Date()), length: m[0].length };
  }
  return null;
}

/**
 * Um valor em dinheiro achado numa linha de PDF, com o que está colado nele: o menos, o mais e
 * a letra C/D logo depois. A letra é lida junto do VALOR, não do fim da linha: na Caixa e no
 * Santander de internet banking a linha traz o lançamento e o saldo ("250,00 C 1.250,00 C"), e o
 * C/D do fim da linha é o do saldo.
 */
type ValorNaLinha = { magnitude: number; menos: boolean; tracoSolto: boolean; mais: boolean; marca: "C" | "D" | null };

/** Um lançamento lido do texto, antes de decidir o sinal: a decisão olha o arquivo inteiro. */
type RegistroDeTexto = { date: string; text: string; valores: ValorNaLinha[]; linhaDeSaldo: boolean };

// O número começa numa borda (nada de dígito, ponto ou vírgula colado à esquerda) e aceita
// valor sem ponto de milhar: em "1500,00" o regex antigo pegava só "500,00" e o "1" ia pra
// descrição — o gasto de R$ 1.500 entrava como R$ 500.
const DINHEIRO_SRC = String.raw`-?\s?(?:R\$\s?)?(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)`;
/** Valor com o "+" antes e o C/D depois ("+R$ 50,00", "250,00 C"), que também saem da descrição. */
const VALOR_NA_LINHA_RE = new RegExp(String.raw`(\+\s?)?(${DINHEIRO_SRC})(?:\s*([CD])\b)?`, "g");

function lerValores(trecho: string): ValorNaLinha[] {
  return [...trecho.matchAll(VALOR_NA_LINHA_RE)].map((m) => {
    const bruto = m[2].trim();
    return {
      magnitude: Math.abs(parseBrazilianNumber(bruto)),
      // Menos colado no número ("-3.000,00", "-R$ 80,00") é sinal. Traço com espaço
      // ("SALARIO EMPRESA - 3.000,00") pode ser só o separador entre descrição e valor.
      menos: /^-(?:\d|R\$)/.test(bruto),
      tracoSolto: /^-\s/.test(bruto),
      mais: Boolean(m[1]),
      marca: (m[3] as "C" | "D" | undefined) ?? null,
    };
  });
}

/** Valor com o sinal que ele mesmo carrega: serve pro SALDO, que não passa pelas palavras. */
function comSinalProprio(v: ValorNaLinha): number {
  return v.menos || v.marca === "D" ? -v.magnitude : v.magnitude;
}

/** Os dois números batem? (Centavo de arredondamento não conta.) */
function mesmoValor(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** "Data  Histórico  Valor  Saldo": cabeçalho de extrato que tem coluna de saldo. */
function temCabecalhoComSaldo(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((l) => !/\d,\d{2}/.test(l) && /\bsaldo\b/i.test(l) && /\b(valor|hist[óo]rico|descri|lan[çc]amento|docto|documento|entrada|sa[íi]da|cr[ée]dito|d[ée]bito)/i.test(l));
}

/**
 * O arquivo tem coluna de saldo? Então o ÚLTIMO número de cada linha é o saldo, e o lançamento é
 * o penúltimo. Antes o genérico pegava sempre o último: na Caixa "PAG BOLETO 150,00 D 1.100,00 C"
 * virava ENTRADA de R$ 1.100, e no Santander "PIX RECEBIDO 250,00 1.250,00" virava R$ 1.250.
 * Vale quando o cabeçalho diz "saldo" (e não é fatura) e ao menos 30% dos lançamentos trazem dois
 * números — tem banco que só imprime o saldo no último lançamento do dia —, OU quando metade traz
 * dois números e o saldo corre (o de uma linha é o da anterior mais ou menos o valor desta).
 * Fatura com "US$ 10,00  R$ 52,30" não cai aqui: não tem cabeçalho de saldo e os números não correm.
 */
function temColunaDeSaldo(registros: RegistroDeTexto[], content: string): boolean {
  const movimentos = registros.filter((r) => !r.linhaDeSaldo && r.valores.length > 0);
  // EXATAMENTE dois: com três ou mais ("R$ 1.500,00  R$ 0,00  R$ 0,00  R$ 1.500,00" do extrato
  // de fundo: bruto, IR, IOF, líquido) o último não é saldo, e o penúltimo seria o IOF zerado.
  const comDois = movimentos.filter((r) => r.valores.length === 2);
  if (comDois.length < 2) return false;
  if (temCabecalhoComSaldo(content) && !PALAVRAS_DE_FATURA_RE.test(content) && comDois.length >= movimentos.length * 0.3) return true;
  if (comDois.length * 2 < movimentos.length) return false;
  let anterior: number | null = null;
  let conferidos = 0;
  let batem = 0;
  for (const r of registros) {
    const ultimo = r.valores[r.valores.length - 1];
    if (r.linhaDeSaldo) {
      if (ultimo && /saldo/i.test(r.text)) anterior = comSinalProprio(ultimo);
      continue;
    }
    if (r.valores.length !== 2) {
      anterior = null;
      continue;
    }
    const saldo = comSinalProprio(ultimo);
    if (anterior !== null) {
      conferidos += 1;
      if (mesmoValor(Math.abs(saldo - anterior), r.valores[r.valores.length - 2].magnitude)) batem += 1;
    }
    anterior = saldo;
  }
  return batem >= 1 && batem * 2 >= conferidos;
}

/** Palavras que só a fatura de cartão tem: nela, número sem sinal é COMPRA, nunca entrada. */
const PALAVRAS_DE_FATURA_RE =
  /limite\s+(?:dispon[ií]vel|total|de\s+cr[eé]dito)|pagamento\s+m[ií]nimo|total\s+(?:da|desta)\s+fatura|fatura\s+anterior|melhor\s+dia\s+de\s+compra|resumo\s+da\s+fatura/i;

/**
 * O banco marca só a SAÍDA, com "-", e a entrada vem sem sinal? É o extrato do Itaú (e de vários
 * outros): "-180,00" é o boleto, "3.000,00" é o salário. Antes todo número sem sinal e sem
 * palavra de entrada virava gasto: "SISPAG SALARIOS", "PIX TRANSF MARIA" e o TED recebido
 * entravam como saída, e nenhum aviso disparava. Vale quando o arquivo não usa C/D, pelo menos
 * 30% dos valores vêm com "-" (é o jeito do banco, não um estorno perdido) e não há palavra de
 * fatura: na fatura o "-" é o pagamento ou o estorno, e o resto é compra.
 */
function sinalSoPeloMenos(escolhidos: ValorNaLinha[], content: string): boolean {
  if (escolhidos.some((v) => v.marca !== null || v.mais)) return false;
  const comMenos = escolhidos.filter((v) => v.menos).length;
  return comMenos >= 2 && comMenos < escolhidos.length && comMenos >= escolhidos.length * 0.3 && !PALAVRAS_DE_FATURA_RE.test(content);
}

/** Sinal pelo próprio valor e pelas palavras da linha, quando o saldo não diz. */
function sinalPelaLinha(v: ValorNaLinha, text: string, semSinalEEntrada: boolean): 1 | -1 {
  const entrada = temPalavraDeEntrada(text);
  // Traço solto com palavra de entrada ("SALARIO EMPRESA - 3.000,00") é separador, não sinal.
  if (v.menos || v.marca === "D" || (v.tracoSolto && !entrada)) return -1;
  if (v.mais || v.marca === "C" || entrada) return 1;
  // Sem sinal nenhum: saída (a maioria das linhas é gasto), menos no banco que só marca a saída.
  return semSinalEEntrada && !v.tracoSolto ? 1 : -1;
}

/**
 * Parser de texto solto (PDF). Um lançamento COMEÇA numa linha com data e termina na primeira
 * linha que traz um valor: pode ser a mesma linha ("12/08 IFOOD 45,90") ou a descrição pode
 * descer por uma ou duas linhas antes do valor (Inter, C6, Itaú). Linhas de saldo/total não
 * contam. O sinal é decidido depois de ler o arquivo inteiro, na ordem: a variação do saldo
 * (quando o arquivo tem coluna de saldo), o sinal do próprio valor ("-", "+", C/D), a palavra
 * de entrada e, por último, o jeito do banco (ver `sinalSoPeloMenos`); sem nada disso, saída.
 */
export function parseTextLines(content: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // "−R$ 1.671,14": a fatura do Nubank usa o sinal de menos tipográfico (U+2212), não o hífen.
  // Sem isto o pagamento da fatura anterior perdia o sinal e entrava como mais uma compra.
  const texto = content.replace(/\u2212/g, "-");
  const lines = texto.split(/\r?\n/);
  const anyDateRe = /(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/;

  // 1ª passada: separa os lançamentos (data, descrição e os números da linha do valor).
  const registros: RegistroDeTexto[] = [];
  let open: { date: string; parts: string[]; lines: number } | null = null;
  const fechar = (valores: ValorNaLinha[]) => {
    if (!open) return;
    const text = open.parts.join(" ").replace(/\s+/g, " ").replace(/\b[DC]\b\s*$/, "").trim();
    // "Lançamentos: R$ 10.290,88" no topo de cada página (extrato do BTG) é o total, não um
    // lançamento: entrava uma vez por página, com a data do cabeçalho.
    registros.push({ date: open.date, text, valores, linhaDeSaldo: BALANCE_LINE_RE.test(text) || /\blan[çc]amentos:\s*$/i.test(text) });
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
      const valores = lerValores(rest);
      open.parts.push(valores.length > 0 ? rest.replace(VALOR_NA_LINHA_RE, " ") : rest);
      if (valores.length > 0) fechar(valores);
      continue;
    }
    if (!open) continue;
    open.lines += 1;
    const valores = lerValores(line);
    if (valores.length > 0) {
      open.parts.push(line.replace(VALOR_NA_LINHA_RE, " "));
      fechar(valores);
    } else if (open.lines <= 3) {
      open.parts.push(line);
    } else {
      open = null;
    }
  }

  // 2ª passada: com o arquivo inteiro à vista, decide qual número é o lançamento e o sinal.
  const saldoNaColuna = temColunaDeSaldo(registros, texto);
  // Penúltimo zerado não é lançamento: aí vale o último, como sempre foi.
  const temDoisNumeros = (r: RegistroDeTexto) => saldoNaColuna && r.valores.length === 2 && r.valores[0].magnitude > 0;
  const valorDo = (r: RegistroDeTexto) => r.valores[r.valores.length - (temDoisNumeros(r) ? 2 : 1)];
  const semSinalEEntrada = sinalSoPeloMenos(
    registros.filter((r) => !r.linhaDeSaldo).map(valorDo),
    texto,
  );

  const transactions: ParsedTransaction[] = [];
  let saldoAnterior: number | null = null;
  for (const r of registros) {
    const ultimo = r.valores[r.valores.length - 1];
    if (r.linhaDeSaldo) {
      // "SALDO ANTERIOR 1.000,00" não é lançamento, mas é o ponto de partida do saldo corrido.
      if (saldoNaColuna && /saldo/i.test(r.text)) saldoAnterior = comSinalProprio(ultimo);
      continue;
    }
    const v = valorDo(r);
    let sinal: 1 | -1 | null = null;
    if (temDoisNumeros(r)) {
      // Com coluna de saldo, quem diz o sinal é o saldo: subiu, entrou; desceu, saiu. Vale até
      // quando a linha não tem sinal nenhum (colunas Entrada/Saída/Saldo sem "-").
      const saldo = comSinalProprio(ultimo);
      if (saldoAnterior !== null && saldo !== saldoAnterior && mesmoValor(Math.abs(saldo - saldoAnterior), v.magnitude)) {
        sinal = saldo > saldoAnterior ? 1 : -1;
      }
      saldoAnterior = saldo;
    }
    if (!(v.magnitude > 0)) continue;
    sinal ??= sinalPelaLinha(v, r.text, semSinalEEntrada);
    if (!temDoisNumeros(r) && saldoAnterior !== null) saldoAnterior += sinal * v.magnitude;
    transactions.push({ date: r.date, description: r.text || "Lançamento", amount: sinal * v.magnitude });
  }
  return transactions;
}

/** Leitores próprios de cada banco, na ordem em que são tentados. Cada um foi conferido com
 * arquivo real do banco contra os totais impressos — por isso a leitura deles vale mesmo quando
 * o arquivo não traz um total pra conferir (ver `leituraIncompleta` em conferencia.ts). */
const LEITORES_PDF: { nome: string; reconhece: (t: string) => boolean; le: (t: string, ano?: number) => ParsedTransaction[] }[] = [
  { nome: "nubank", reconhece: isNubankStatement, le: (t) => parseNubankStatement(t) },
  { nome: "caixa", reconhece: isCaixaAppStatement, le: (t, ano) => parseCaixaAppStatement(t, ano) },
  { nome: "santander", reconhece: isSantanderConsolidatedStatement, le: (t, ano) => parseSantanderConsolidatedStatement(t, ano) },
  { nome: "inter", reconhece: isInterStatement, le: (t) => parseInterStatement(t) },
  { nome: "banestes", reconhece: isBanestesStatement, le: (t, ano) => parseBanestesStatement(t, ano) },
  { nome: "banco-do-brasil", reconhece: isBancoDoBrasilStatement, le: (t) => parseBancoDoBrasilStatement(t) },
  { nome: "bradesco", reconhece: isBradescoStatement, le: (t) => parseBradescoStatement(t) },
  { nome: "bradesco-fatura", reconhece: isBradescoInvoice, le: (t, ano) => parseBradescoInvoice(t, ano) },
  { nome: "cora", reconhece: isCoraStatement, le: (t) => parseCoraStatement(t) },
  { nome: "mercado-pago", reconhece: isMercadoPagoStatement, le: (t) => parseMercadoPagoStatement(t) },
  { nome: "inter-fatura", reconhece: isInterInvoice, le: (t) => parseInterInvoice(t) },
  { nome: "ourocard", reconhece: isOurocardInvoice, le: (t, ano) => parseOurocardInvoice(t, ano) },
  { nome: "itau-fatura", reconhece: isItauInvoice, le: (t, ano) => parseItauInvoice(t, ano) },
  { nome: "riachuelo-midway", reconhece: isMidwayInvoice, le: (t) => parseMidwayInvoice(t) },
  { nome: "c6-fatura", reconhece: isC6Invoice, le: (t, ano) => parseC6Invoice(t, ano) },
  { nome: "santander-fatura", reconhece: isSantanderInvoice, le: (t, ano) => parseSantanderInvoice(t, ano) },
  { nome: "nubank-fatura", reconhece: isNubankInvoice, le: (t, ano) => parseNubankInvoice(t, ano) },
];

/** Igual a `parseStatement`, e diz QUEM leu: o nome do leitor próprio do banco, ou null quando
 * foi o leitor genérico (texto solto, CSV, OFX). */
export function parseStatementComLeitor(
  content: string,
  source: "auto" | "pdf" = "auto",
  refYear?: number,
): { txns: ParsedTransaction[]; leitor: string | null } {
  if (source === "pdf") {
    let proprio: { txns: ParsedTransaction[]; leitor: string } | null = null;
    for (const leitor of LEITORES_PDF) {
      if (!leitor.reconhece(content)) continue;
      const txns = leitor.le(content, refYear);
      if (txns.length > 0) {
        proprio = { txns, leitor: leitor.nome };
        break;
      }
    }
    // O leitor do banco vale, a menos que a soma dele NÃO bata com a fatura (layout novo do
    // mesmo banco). O genérico vale quando fecha. Senão, o leitor que testa jeitos de ler
    // (leitor-inteligente.ts) tenta — e só entra se fechar no centavo com o total impresso.
    if (proprio && fechaComoFatura(content, proprio.txns) !== "nao-fechou") return proprio;
    const generico = proprio ?? { txns: parseTextLines(content, refYear), leitor: null };
    if (!proprio && fechaComoFatura(content, generico.txns) === "fechou") return generico;
    const testando = lerFaturaTestando(content, refYear);
    return testando ? { txns: testando, leitor: "inteligente" } : generico;
  }
  return { txns: isOfx(content) ? parseOfx(content) : parseCsv(content, refYear), leitor: null };
}

/** `source` "pdf" força os parsers de texto (os de cada banco primeiro, depois o genérico por
 * linha); caso contrário detecta OFX vs CSV. */
export function parseStatement(content: string, source: "auto" | "pdf" = "auto", refYear?: number): ParsedTransaction[] {
  return parseStatementComLeitor(content, source, refYear).txns;
}
