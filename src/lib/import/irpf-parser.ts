import { parseBrazilianNumber } from "./statement-parser";
import { parseFlexibleNumber } from "./portfolio-parser";

/**
 * Parser da "Declaração de Bens e Direitos" do IRPF (imagem/recibo em PDF) — extrai o PREÇO
 * MÉDIO (custo de aquisição) de ações, FIIs e ETFs, que os extratos de corretora quase nunca
 * trazem. É o que permite calcular lucro/prejuízo de verdade na carteira.
 *
 * Desenhado contra o texto que o `pdf-parse` (Node) produz — cada ativo vira um bloco:
 *
 *   07 EQI - 004389249 - FUNDO IMOBILIÁRIO MXRF11 - 1000   ← <grupo> + discriminação
 *   QUOTAS A UM CUSTO MÉDIO DE R$ 10,29                     ← continuação da discriminação
 *   0,00 10.290,00                                          ← situação 31/12/2024  31/12/2025
 *   CNPJ do Fundo: 97.521.225/0001-25
 *   03	2004                                               ← <código>  <nº do bem>
 *   105 - BRASIL                                            ← país
 *   ...
 *   Código de Negociação: MXRF11	Negociados em Bolsa: Sim
 *
 * Só interessam os grupos/códigos negociados em bolsa que têm preço médio:
 *   grupo 03 código 01 = ações · grupo 07 código 03 = FIIs · grupo 07 código 08 = ETFs.
 */

export type IrpfAssetKind = "acao" | "fii" | "etf";

export type IrpfAsset = {
  /** Ticker B3/EUA quando identificável na declaração (FLRY3, MXRF11, AAPL); null quando a
   * declaração só traz o nome da empresa (aí o casamento com a carteira é por nome/manual). */
  ticker: string | null;
  /** Nome legível derivado da discriminação — para exibir e casar por nome quando falta ticker. */
  name: string;
  quantity: number | null;
  /** Preço médio por ação/cota (custo de aquisição unitário). */
  averagePrice: number | null;
  /** Custo total de aquisição na situação em 31/12 do ano-calendário (a base do investido). */
  totalCost: number | null;
  kind: IrpfAssetKind;
};

const KIND_BY_GROUP_CODE: Record<string, IrpfAssetKind> = {
  "0301": "acao",
  "0703": "fii",
  "0708": "etf",
};

/** Ticker B3: 4 letras + 1–2 dígitos (PETR4, ITUB3, HGLG11, MXRF11). */
const B3_TICKER_RE = /\b([A-Z]{4}\d{1,2})\b/;
/** Token monetário BR: "10.290,00", "1.043,95", "0,00", "15,86" (2+ casas decimais). */
const MONEY = String.raw`\d{1,3}(?:\.\d{3})*,\d{2,}|\d+,\d{2,}`;
/** Linha "código  nº-do-bem": código de 2 dígitos + id de 4 dígitos (ex.: "03 2004").
 * Global: texto livre da discriminação pode conter pares parecidos ("COMPRA EM 10 2024") —
 * o marcador de verdade é sempre o ÚLTIMO par do bloco (vem depois da situação em 31/12). */
const CODE_BEM_RE = /(?:^|\s)(\d{2})\s+(\d{4})(?:\s|$)/g;

/** Início de um bloco de bem: GRUPO VÁLIDO da Receita (01-09 ou 99) + espaço + letra (a
 * discriminação começa com texto). Restringir aos grupos reais evita que uma linha de texto
 * corrido como "EM 31 DE DEZEMBRO" (31 + letra) abra um bloco falso e trunque o bem anterior. */
const BLOCK_START_RE = /^(0[1-9]|99) +[A-Za-zÀ-ÿ]/;

/** Quantidade seguida da unidade ("- 110 ACOES", "826 QUOTAS", "10 COTAS", "1 ACAO", "48 FUNDOS"). */
const QTY_RE = /(\d[\d.,]*)\s*(?:AÇÕES|ACOES|AÇÃO|ACAO|QUOTAS|QUOTA|COTAS|COTA|FUNDOS|FUNDO)\b/i;
/** Quantidade no formato "QTDE: 0,582" (ações fracionárias do exterior). */
const QTY_QTDE_RE = /QTDE:?\s*(\d[\d.,]*)/i;

/** Preço médio unitário declarado explicitamente, em várias redações que a Receita aceita. */
const AVG_PRICE_PATTERNS = [
  /CUSTO\s+M[ÉE]DIO\s+DE\s+R\$\s*:?\s*([\d.]+,\d+)/i,
  /CUSTO\s+UNIT[ÁA]RIO\s+DE\s+R\$\s*:?\s*([\d.]+,\d+)/i,
  /(?:NO\s+)?CUSTO\s+DE\s+R\$\s*:?\s*([\d.]+,\d+)/i,
  /QUOTAS?\s+A\s+R\$\s*([\d.]+,\d+)/i,
  /COTAS?\s+A\s+R\$?\s*([\d.]+,\d+)\s+CADA/i,
  /COTAS?\s+A\s+([\d.]+,\d+)\s+CADA/i,
];

const COD_NEG_RE = /C[óo]digo de Negocia[çc][ãa]o:\s*([^\t\n]+?)(?:\s+Negociados|\s*$)/i;
// Código do país (105 = Brasil, 249 = EUA…). O `(?:^|\D)` impede casar os 3 últimos dígitos de
// um número de conta ("EQI - 004389249 - AÇÕES" NÃO é país 249) — só o código de país de verdade,
// que vem precedido de espaço e seguido do nome do país.
const COUNTRY_RE = /(?:^|\D)(\d{3})\s*-\s*[A-ZÀ-Ÿ]/;

function toNum(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseBrazilianNumber(raw);
  return Number.isFinite(n) ? n : null;
}

/** Ticker a partir do texto do bloco (padrão B3) ou do "Código de Negociação" (limpo). */
function extractTicker(blockUpper: string, codNeg: string | null, foreign: boolean): string | null {
  const b3 = blockUpper.match(B3_TICKER_RE);
  if (b3) return b3[1];
  if (codNeg) {
    const compact = codNeg.replace(/\s+/g, "").toUpperCase();
    if (/^[A-Z]{4}\d{1,2}$/.test(compact)) return compact; // "MCCI 11" → "MCCI11"
    if (foreign && /^[A-Z]{1,5}$/.test(compact)) return compact; // AAPL, JNJ, AMZN
  }
  return null;
}

/** Nome curto e legível a partir da discriminação (tira prefixo de grupo, conta EQI e o texto
 * de custo/quantidade), pra exibir e casar por nome quando não há ticker. */
function cleanName(disc: string): string {
  return disc
    .replace(/^\d{2}\s+/, "")
    .replace(/\b(EQI|XP)\b\s*-?\s*\d*\s*-?\s*/gi, "")
    .replace(/\bFUNDOS?\b\s*-?\s*/gi, "")
    .replace(/\s*[-–]?\s*\d[\d.,]*\s*(A[ÇC][ÕO]ES|ACOES|QUOTAS|COTAS|FUNDOS?)\b.*$/i, "")
    .replace(/\s+(NO\s+|A\s+UM\s+|A\s+)?CUSTO\b.*$/i, "")
    .replace(/\s+QTDE.*$/i, "")
    .replace(/\s+\d[\d.,]*,\d{2}.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Preço médio explícito na discriminação, se houver (preferido ao calculado, evita arredondar). */
function extractExplicitAvg(block: string): number | null {
  for (const re of AVG_PRICE_PATTERNS) {
    const m = block.match(re);
    if (m) {
      const n = toNum(m[1]);
      if (n !== null && n > 0) return n;
    }
  }
  return null;
}

/**
 * Localiza o marcador "código  nº-do-bem" e devolve o código + o custo de aquisição de 2025.
 * O valor de 2025 (situação atual) é o ÚLTIMO número monetário ANTES desse marcador — mais
 * confiável que "o último par do bloco", porque a discriminação às vezes repete o total
 * ("… TOTAL R$ 1.826,85") e as linhas de rendimento/imposto trazem outros valores. */
function extractCodeAndTotal(block: string): { codigo: string; total: number | null } {
  // ÚLTIMO par "código nº-bem" do bloco — pares parecidos no texto livre vêm antes do real.
  let m: RegExpMatchArray | null = null;
  for (const match of block.matchAll(CODE_BEM_RE)) m = match;
  const codigo = m ? m[1] : "";
  const before = m && m.index !== undefined ? block.slice(0, m.index) : block;
  const tokens = before.match(new RegExp(MONEY, "g")) ?? [];
  const total = tokens.length > 0 ? toNum(tokens[tokens.length - 1]) : null;
  return { codigo, total };
}

/** Quantidade — ignora o prefixo de grupo ("07 FUNDOS…" senão "07"+"FUNDOS" viraria quantidade).
 * Usa o parse flexível: "1.000 QUOTAS" é MIL (milhar com ponto, sem vírgula), "332,6" é decimal
 * BR e "4.2" (fração de ação dos EUA) é decimal americano — parseBrazilianNumber leria
 * "1.000" como 1 e multiplicaria o preço médio por 1000. */
function extractQuantity(block: string): number | null {
  const body = block.replace(/^\d{2}\s+/, "");
  const m = body.match(QTY_RE) ?? body.match(QTY_QTDE_RE);
  if (!m) return null;
  const n = parseFlexibleNumber(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recebe o texto cru do PDF (via pdf-parse) e devolve os ativos com preço médio.
 * Robusto a lixo de outras seções: só emite bens dos grupos/códigos negociados em bolsa.
 */
export function parseIrpfBensEDireitos(content: string): IrpfAsset[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter((l) => l !== "");

  // Índices onde um novo bloco de bem começa (discriminação).
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (BLOCK_START_RE.test(lines[i])) starts.push(i);
  }

  const assets: IrpfAsset[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const blockLines = lines.slice(from, to);
    const block = blockLines.join(" ");

    const grupo = lines[from].slice(0, 2);
    const { codigo, total } = extractCodeAndTotal(block);
    const kind = KIND_BY_GROUP_CODE[`${grupo}${codigo}`];
    if (!kind) continue; // não é ação/FII/ETF negociado em bolsa — ignora (CDB, fundo, imóvel…)

    // Posição zerada em 31/12 = ativo vendido no ano; não entra (não há preço médio atual).
    if (total !== null && total <= 0) continue;

    const codNegMatch = block.match(COD_NEG_RE);
    const codNeg = codNegMatch ? codNegMatch[1].trim() : null;
    const countryMatch = block.match(COUNTRY_RE);
    const foreign = countryMatch ? countryMatch[1] !== "105" : false;

    const quantity = extractQuantity(block);
    const explicitAvg = extractExplicitAvg(block);
    // Preço médio = custo de aquisição ÷ quantidade (fórmula única e sem ambiguidade). O valor
    // explícito ("custo médio de R$ X") só entra quando a quantidade não foi identificada.
    const averagePrice =
      total !== null && quantity && quantity > 0 ? total / quantity : explicitAvg;
    const totalCost =
      total ?? (explicitAvg !== null && quantity && quantity > 0 ? explicitAvg * quantity : null);

    // Sem preço médio nem custo, não há o que preencher — pula.
    if (averagePrice === null && totalCost === null) continue;

    assets.push({
      ticker: extractTicker(block.toUpperCase(), codNeg, foreign),
      name: cleanName(lines[from]) || (codNeg ?? "Ativo"),
      quantity,
      averagePrice,
      totalCost,
      kind,
    });
  }

  return mergeByTicker(assets);
}

/** Consolida o MESMO ticker que aparece em mais de uma corretora: soma quantidade e custo,
 * recalcula o preço médio ponderado. Entradas sem ticker ficam separadas (casamento manual). */
function mergeByTicker(assets: IrpfAsset[]): IrpfAsset[] {
  const byTicker = new Map<string, IrpfAsset>();
  const noTicker: IrpfAsset[] = [];

  for (const a of assets) {
    if (!a.ticker) {
      noTicker.push(a);
      continue;
    }
    const prev = byTicker.get(a.ticker);
    if (!prev) {
      byTicker.set(a.ticker, { ...a });
      continue;
    }
    const q1 = prev.quantity ?? 0;
    const q2 = a.quantity ?? 0;
    const c1 = prev.totalCost ?? (prev.averagePrice ?? 0) * q1;
    const c2 = a.totalCost ?? (a.averagePrice ?? 0) * q2;
    const qty = q1 + q2;
    const cost = c1 + c2;
    prev.quantity = qty > 0 ? qty : prev.quantity;
    prev.totalCost = cost > 0 ? cost : prev.totalCost;
    prev.averagePrice = qty > 0 ? cost / qty : prev.averagePrice;
  }

  return [...byTicker.values(), ...noTicker];
}
