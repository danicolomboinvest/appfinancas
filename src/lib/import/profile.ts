import { detectDocKind } from "./detect";
import { isNubankStatement } from "./nubank-pdf";

/**
 * Perfil do arquivo importado, lido INTEIRO antes de qualquer decisão.
 *
 * Cada banco monta o arquivo do seu jeito: o extrato da conta investimento do BTG/EQI traz a
 * posição da carteira E uma aba de movimentações; a fatura do C6 tem coluna em dólar; o extrato
 * do Nubank em PDF tem "Saldo do dia". Decidir pela primeira palavra que aparece ("Movimentações"
 * → é extrato, ponto final) barrava arquivo bom. Aqui a gente conta os sinais de cada tipo no
 * texto todo, identifica o banco e o período, e só então diz o que o arquivo é — e mostra pra
 * pessoa o que entendeu, em vez de recusar sem explicar.
 */

export type DocContent = "position" | "movements" | "invoice" | "irpf" | "allocation";
export type DocProfileKind = "position" | "statement" | "invoice" | "irpf" | "unknown";

export type DocProfile = {
  /** Banco/corretora reconhecido no texto, ou null. */
  institution: string | null;
  /** Período coberto ("DD/MM/AAAA"), do cabeçalho ou das datas encontradas. */
  period: { from: string; to: string } | null;
  /** Linhas de ativo com quantidade (ação, FII, ETF, renda fixa). */
  positionRows: number;
  /** Linhas de lançamento (data + valor). */
  movementRows: number;
  hints: { position: number; statement: number; invoice: number; irpf: number; allocation: number };
  /** Tudo que o arquivo tem, não só o tipo dominante. */
  contents: DocContent[];
  kind: DocProfileKind;
  /** Frase pra tela: "Extrato de investimentos (posição + movimentações) · BTG Pactual · 01/09 a 17/09/2026". */
  summary: string;
  /** Por que decidiu assim (curto, pra tela de "esse arquivo parece…"). */
  reason: string;
};

const INSTITUTIONS: [RegExp, string][] = [
  [/btg pactual|\bbtg\b/i, "BTG Pactual"],
  [/nubank|nu pagamentos|nu financeira/i, "Nubank"],
  [/itaucard|\bita[uú]\b/i, "Itaú"],
  [/banco inter\b|inter\s*&\s*co|\binter s\.?a\.?\b/i, "Inter"],
  [/c6 bank|\bc6\b/i, "C6 Bank"],
  [/xp investimentos|\bxp inc\b|\bxpi\b/i, "XP"],
  [/rico investimentos|rico\.com/i, "Rico"],
  [/clear corretora/i, "Clear"],
  [/bradesco/i, "Bradesco"],
  [/santander/i, "Santander"],
  [/caixa econ[oô]mica/i, "Caixa"],
  [/banco do brasil/i, "Banco do Brasil"],
  [/mercado pago/i, "Mercado Pago"],
  [/picpay/i, "PicPay"],
  [/sicoob/i, "Sicoob"],
  [/sicredi/i, "Sicredi"],
  [/pagbank|pagseguro/i, "PagBank"],
  [/genial investimentos/i, "Genial"],
  [/\bwarren\b/i, "Warren"],
  [/[oó]rama/i, "Órama"],
  [/\bavenue\b/i, "Avenue"],
  [/\bnomad\b/i, "Nomad"],
  [/\beqi\b/i, "EQI"],
  [/\bb3\b|[aá]rea do investidor/i, "B3"],
];

const TICKER_CELL_RE = /(^|[;,\t ])([A-Z]{4}\d{1,2})\*?(?=$|[;,\t ])/;
// Planilha com coluna "Ticker/Código" e ativos de fora (VOO, QQQ, SHV): ticker só de letras vale
// quando o cabeçalho diz que a coluna é de ticker, senão "PIX" e "TED" virariam ativo.
const TICKER_HEADER_RE = /(^|[;,\t])\s*(ticker|c[óo]digo|papel|symbol)\s*(?=[;,\t]|$)/i;
const INTL_TICKER_RE = /^[;,\t ]*([A-Z]{1,5})(?=[;,\t])/;
const MONTHS = "jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez";
const MONTHS_FULL = "janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
const DATE_START_RE = /^\s*[;,]?\s*(?:\d{2}\/\d{2}(?:\/\d{2,4})?|\d{2}\s(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b)/i;
const MONEY_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d{1,3}(?:,\d{3})*\.\d{2}\b|-?\d+\.\d{2}\b/;
// Número solto: o "4" de PETR4 não conta como quantidade.
const NUMBER_RE = /(?<![A-Za-z\d])-?\d[\d.,]*/g;
const DATE_FULL_RE = /\b(\d{2})\/(\d{2})\/(\d{2}|\d{4})\b/g;
// "14 SET 2026" e "14 DE SETEMBRO DE 2026" (extrato do Nubank em PDF).
const DATE_WORDS_RE = new RegExp(`\\b(\\d{2})\\s+(?:de\\s+)?(${MONTHS_FULL}|${MONTHS})\\.?\\s+(?:de\\s+)?(\\d{4})\\b`, "gi");

function monthNumber(word: string): string {
  const key = word.toLowerCase().slice(0, 3).replace("ç", "c");
  const idx = MONTHS.split("|").indexOf(key);
  return String(idx + 1).padStart(2, "0");
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function normalizeYear(y: string): string {
  return y.length === 2 ? `20${y}` : y;
}

function toKey(d: { day: string; month: string; year: string }): number {
  return Number(`${d.year}${d.month}${d.day}`);
}

/** "Período de 01/09/26 a 17/09/26" no cabeçalho; senão, menor e maior data com ano no arquivo. */
function detectPeriod(text: string): DocProfile["period"] {
  const head = text.match(/per[íi]odo\s*(?:de)?\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})\s*(?:a|à|at[ée]|-|—)\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (head) {
    const norm = (s: string) => {
      const [d, m, y] = s.split("/");
      return `${d}/${m}/${normalizeYear(y)}`;
    };
    return { from: norm(head[1]), to: norm(head[2]) };
  }
  const found: { day: string; month: string; year: string }[] = [];
  for (const m of text.matchAll(DATE_FULL_RE)) {
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    found.push({ day: m[1], month: m[2], year: normalizeYear(m[3]) });
  }
  for (const m of text.matchAll(DATE_WORDS_RE)) {
    const month = monthNumber(m[2]);
    if (month === "00" || Number(m[1]) < 1 || Number(m[1]) > 31) continue;
    found.push({ day: m[1], month, year: m[3] });
  }
  if (found.length < 2) return null;
  found.sort((a, b) => toKey(a) - toKey(b));
  // Vencimentos de renda fixa e proventos futuros esticariam o período; fica no que já aconteceu.
  const now = new Date();
  const todayKey = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`);
  const past = found.filter((d) => toKey(d) <= todayKey);
  const pool = past.length >= 2 ? past : found;
  const first = pool[0];
  const last = pool[pool.length - 1];
  return { from: `${first.day}/${first.month}/${first.year}`, to: `${last.day}/${last.month}/${last.year}` };
}

function formatPeriod(period: NonNullable<DocProfile["period"]>): string {
  const [fd, fm, fy] = period.from.split("/");
  const [td, tm, ty] = period.to.split("/");
  if (fy === ty) return `${fd}/${fm} a ${td}/${tm}/${ty}`;
  return `${fd}/${fm}/${fy} a ${td}/${tm}/${ty}`;
}

const KIND_LABEL: Record<DocProfileKind, string> = {
  position: "Posição da carteira",
  statement: "Extrato bancário",
  invoice: "Fatura de cartão",
  irpf: "Declaração de bens (IRPF)",
  unknown: "Arquivo que não reconheci",
};

/** Banco que mais aparece, com peso extra pro começo do arquivo (cabeçalho): o extrato do
 * Nubank cita "BTG" numa transferência, mas é do Nubank. */
function detectInstitution(text: string): string | null {
  // O extrato do Nubank em PDF nem sempre diz "Nubank" no alto da página, mas as transferências
  // dizem o banco do OUTRO lado do Pix. Foi assim que o extrato de uma cliente apareceu na tela
  // como "Sicredi" — banco que ela não tem. O molde do documento vale mais que as citações.
  if (isNubankStatement(text)) return "Nubank";
  const head = text.slice(0, 2500);
  let best: { name: string; score: number } | null = null;
  for (const [re, name] of INSTITUTIONS) {
    const all = new RegExp(re.source, "gi");
    const total = (text.match(all) ?? []).length;
    if (total === 0) continue;
    const inHead = (head.match(all) ?? []).length;
    const score = total + inHead * 5;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

export function profileDocument(text: string, fileName?: string | null): DocProfile {
  const lines = text.split(/\r?\n/);
  const hasTickerHeader = TICKER_HEADER_RE.test(text);

  let positionRows = 0;
  let movementRows = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const startsWithDate = DATE_START_RE.test(line);
    const numbers = line.match(NUMBER_RE) ?? [];
    if (!startsWithDate && TICKER_CELL_RE.test(line) && numbers.length >= 2) {
      positionRows += 1;
      continue;
    }
    if (!startsWithDate && hasTickerHeader && INTL_TICKER_RE.test(line) && numbers.length >= 1) {
      positionRows += 1;
      continue;
    }
    if (startsWithDate && MONEY_RE.test(line)) movementRows += 1;
  }

  const hints = {
    position: countMatches(text, [
      /pre[çc]o m[ée]dio/gi,
      /quantidade de cotas/gi,
      /posi[çc][ãa]o\s*>/gi,
      /saldo bruto/gi,
      /valor investido/gi,
      /pre[çc]o de fechamento/gi,
      /cust[óo]dia/gi,
      /posi[çc][ãa]o consolidada/gi,
    ]),
    statement: countMatches(text, [
      /\bextrato\b/gi,
      /saldo (anterior|do dia|final|inicial)/gi,
      /conta corrente/gi,
      /movimenta[çc][õo]es/gi,
      /<bankmsgsrsv1>|<stmtrs>|<bankacctfrom>/gi,
      /\blan[çc]amentos\b/gi,
    ]),
    invoice: countMatches(text, [
      /\bfatura\b/gi,
      /\bvencimento\b/gi,
      /limite dispon[ií]vel/gi,
      /pagamento m[ií]nimo/gi,
      /final do cart[ãa]o/gi,
      /<creditcardmsgsrsv1>|<ccstmtrs>|<ccacctfrom>/gi,
      /total da fatura/gi,
    ]),
    irpf: countMatches(text, [/bens e direitos/gi, /declara[çc][ãa]o de ajuste anual/gi, /situa[çc][ãa]o em 31\/12/gi, /\bdiscrimina[çc][ãa]o\b/gi]),
    allocation: /classifica[çc][ãa]o/i.test(text) && /pre[çc]o atual/i.test(text) ? 1 : 0,
  };

  const contents: DocContent[] = [];
  const positionScore = positionRows * 2 + hints.position;
  if (hints.allocation > 0) contents.push("allocation");
  if (positionRows > 0 && positionScore >= 3) contents.push("position");
  if (hints.irpf >= 2) contents.push("irpf");
  if (movementRows >= 1 && (hints.invoice > 0 || hints.statement > 0 || !contents.includes("position"))) {
    contents.push(hints.invoice > hints.statement && hints.statement <= 1 ? "invoice" : "movements");
  } else if (movementRows >= 3) {
    contents.push("movements");
  }

  const known = detectDocKind(text, fileName);
  let kind: DocProfileKind = "unknown";
  let reason = "";
  if (contents.includes("allocation")) {
    kind = "position";
    reason = "planilha de alocação (Classificação + Ativo + Preço atual)";
  } else if (contents.includes("irpf")) {
    // A declaração lista ativos com quantidade, mas o caminho dela é outro (preço médio pro IR).
    kind = "irpf";
    reason = "declaração de bens e direitos";
  } else if (contents.includes("position")) {
    kind = "position";
    reason = `${positionRows} linha${positionRows === 1 ? "" : "s"} de ativo com quantidade`;
  } else if (contents.includes("invoice") || contents.includes("movements")) {
    if (known.kind !== "unknown") {
      kind = known.kind === "fatura" ? "invoice" : "statement";
      reason = known.reason;
    } else if (contents.includes("invoice")) {
      kind = "invoice";
      reason = "palavras de fatura (vencimento, limite, total da fatura)";
    } else {
      kind = "statement";
      reason = `${movementRows} lançamento${movementRows === 1 ? "" : "s"} com data e valor`;
    }
  } else if (known.kind !== "unknown") {
    kind = known.kind === "fatura" ? "invoice" : "statement";
    reason = known.reason;
  }

  const institution = detectInstitution(text);
  const period = detectPeriod(text);

  const label =
    kind === "position" && contents.includes("movements")
      ? "Extrato de investimentos (posição + movimentações)"
      : KIND_LABEL[kind];
  // Sem contagens aqui: a tela mostra os números do parser ("Li 115 de 120 linhas", "Novos (14)"),
  // e dois números diferentes pro mesmo arquivo só confundiriam.
  const parts = [institution ? `${label} · ${institution}` : label];
  if (period) parts.push(formatPeriod(period));

  return {
    institution,
    period,
    positionRows,
    movementRows,
    hints,
    contents,
    kind,
    summary: parts.join(" · "),
    reason,
  };
}
