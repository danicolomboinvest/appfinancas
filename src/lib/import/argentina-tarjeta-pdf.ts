import { cierreArgentino, dataArgentinaNoInicio, numeroArgentino, pareceDaArgentina, vencimientoArgentino } from "./argentina";
import type { ParsedTransaction } from "./statement-parser";

/**
 * Fatura de cartão da Argentina, o "resumen de tarjeta" (Visa e Mastercard dos bancos, Cabal,
 * American Express, Naranja X). O molde comum, como os parsers abertos que leem esses resumos
 * descrevem (github.com/NicoPelos/resumen-dashboard, github.com/damiiraola/cifra e
 * github.com/cristianndan14/finance-consolidation-app):
 *
 *   FECHA      COMPROBANTE  DETALLE DE TRANSACCION        CUOTA     PESOS       DOLARES
 *   06-Ago-26  004512 *     COTO SUC 123                            45.320,10
 *   12−08−26                FRAVEGA                       C.03/06   18.500,00   004513
 *   15-Ago-26  004530       NETFLIX.COM USD 9,99                                 9,99
 *              SU PAGO EN PESOS                                     512.640,25−
 *              IMPUESTO DE SELLOS $                                 1.546,77
 *   30-Ago-26  DB.RG 5617 30% ( 27966,01 )                          8.389,80
 *
 * - data "06-Ago-26", "12−08−26" (com o menos tipográfico), "12/08/26", "04 SEP", "26 Setiem 26";
 * - o número do comprovante (Visa depois do detalhe, Cabal antes) não é valor nem descrição;
 * - a parcela: "C.03/06", "cta 04/06", "Cuota 03/06", "CUOTA 06 DE 06";
 * - o sinal do crédito e do pagamento vem DEPOIS do número ("512.640,25-");
 * - duas colunas de dinheiro, PESOS e DOLARES. No texto do PDF não dá pra saber a coluna pela
 *   posição; a compra em dólar se denuncia pelo "USD"/"U$S" na linha. Ela fica FORA da leitura em
 *   pesos (sem misturar moedas): o saldo em dólar a fatura cobra à parte, e quando ela paga em
 *   pesos o pagamento aparece no extrato da conta.
 * - impostos e encargos (Impuesto PAIS, percepções da RG 4815/5617, IIBB, IVA, selos, comissão,
 *   juros) às vezes vêm sem data: entram com a data do fechamento, porque são gasto de verdade.
 *
 * Compra sai POSITIVA, pagamento e crédito NEGATIVOS, como nos outros leitores de fatura.
 */

const MARCAS_DE_RESUMEN =
  /\b(?:pago\s+m[ií]nimo|cierre\s+actual|vencimiento\s+actual|total\s+(?:de\s+)?consumos|saldo\s+actual|su\s+pago\s+en|l[ií]mite\s+de\s+compras?|resumen\s+de\s+(?:cuenta\s+)?tarjeta|consumos\s+del\s+per[ií]odo)\b/gi;

export function isArgentinaTarjeta(texto: string): boolean {
  if (!pareceDaArgentina(texto)) return false;
  const marcas = new Set([...texto.slice(0, 12000).matchAll(MARCAS_DE_RESUMEN)].map((m) => m[0].toLowerCase().replace(/\s+/g, " ").slice(0, 10)));
  return marcas.size >= 2;
}

const MENOS = /[−–—]/g;
/** Valor em dinheiro com o sinal colado antes ou depois. Aceita sem ponto de milhar ("27966,01"). */
const VALOR_RE = /(?<![\d.,])(-?)\s?(?:\$\s?)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(-(?!\d))?(?![\d,])/g;
/** A parcela: "C.03/06", "cta 04/06", "Cuota 03/06", "CUOTA 06 DE 06" (ou só "03/06", ver abaixo). */
const CUOTA_COM_PALAVRA_RE = /\b(?:c\.\s?|cta\.?\s*|cuotas?\s+)(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})\b/i;
/** Linha que fala em dólar: a compra é na coluna DOLARES. */
const DOLAR_RE = /\bU\$S\b|\bUSD\b|\bU\$D\b|\bUS\$/i;
/** Resumo, não lançamento. */
const NAO_E_LANCAMENTO_RE =
  /\b(saldo\s+(?:anterior|actual|pendiente)|total\s+(?:de\s+)?consumos|total\s+a\s+pagar|pago\s+m[ií]nimo|l[ií]mite|cierre|vencimiento|pr[oó]ximo\s+vto|tasa|t\.?n\.?a|t\.?e\.?a|c\.?f\.?t|cuotas\s+a\s+vencer|plan\s+v\b)/i;
/** O pagamento da fatura anterior. */
const PAGO_RE = /\bsu\s+pago\b|\bpago\s+en\s+(?:pesos|d[oó]lares|usd)\b|\bpago\s+(?:del\s+)?resumen\b/i;
/** Encargo ou imposto (pode vir sem data). */
const CARGO_RE = /\b(comisi[oó]n|iva|sellad|sellos|impuesto|imp\.|interes|intereses|percep|iibb|retenc|punitor|mantenim|renovaci[oó]n|cargo|seguro\s+de\s+vida|db\.?\s?rg|rg\s?\d{4})/i;
/** Começo da tabela de lançamentos ("FECHA ... DETALLE ..."). */
const CABECALHO_RE = /\bfecha\b.*\b(?:detalle|descripci[oó]n|concepto|comprobante)\b/i;
/** Daqui pra baixo é o quadro das parcelas que ainda vão vencer, não compra deste mês. */
const FIM_RE = /\bcuotas\s+a\s+vencer\b|\bplan\s+de\s+cuotas\b|\bpr[oó]ximos\s+vencimientos\b/i;

type Linha = { date: string; descricao: string; valor: number; emDolar: boolean };

function limparDescricao(texto: string): { descricao: string; cuota: string | null } {
  let t = texto.replace(VALOR_RE, " ");
  let cuota: string | null = null;
  const c = t.match(CUOTA_COM_PALAVRA_RE) ?? t.match(/(?:^|\s)(\d{2})\/(\d{2})(?=\s|$)/);
  if (c && Number(c[1]) >= 1 && Number(c[2]) >= 2 && Number(c[1]) <= Number(c[2])) {
    cuota = `Cuota ${c[1].padStart(2, "0")}/${c[2].padStart(2, "0")}`;
    t = t.replace(c[0], " ");
  }
  t = t
    // O comprovante: 4 a 8 dígitos soltos, às vezes com "*" ou "K" grudado.
    // Menos o número da norma: "DB.RG 5617", "IMP. LEY 25413".
    .replace(/(^|\s)(?<!\b(?:rg|ley|nro|n°)\.?\s)[*K]?\d{4,8}\s?[*K]?(?=\s|$)/gi, "$1")
    .replace(/(?:^|\s)[*]+(?=\s|$)/g, " ")
    .replace(/\(\s*\)/g, " ")
    // O "$" que sobra do rótulo ("IMPUESTO DE SELLOS $").
    .replace(/(?:^|\s)(?:\$|U\$S)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { descricao: t, cuota };
}

export function parseArgentinaTarjeta(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const cierre = cierreArgentino(texto);
  const vencimiento = vencimientoArgentino(texto);
  const referencia = cierre ?? vencimiento;
  const anoRef = referencia ? Number(referencia.slice(0, 4)) : refYear;
  const limite = referencia ? Date.parse(`${referencia}T12:00:00Z`) + 31 * 86_400_000 : null;
  /** Sem ano na linha: compra depois do fechamento é do ano anterior. */
  const ajustarAno = (iso: string, temAno: boolean): string => {
    if (temAno || limite === null || Date.parse(`${iso}T12:00:00Z`) <= limite) return iso;
    return `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
  };

  const linhas = texto.replace(MENOS, "-").split(/\r?\n/);
  const temCabecalho = linhas.some((l) => CABECALHO_RE.test(l));
  let dentro = !temCabecalho;
  let ultimaData: string | null = null;
  const lidas: Linha[] = [];

  for (const bruta of linhas) {
    const linha = bruta.replace(/\t/g, "  ").trim();
    if (!linha) continue;
    if (CABECALHO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (FIM_RE.test(linha)) {
      dentro = false;
      continue;
    }
    const data = dataArgentinaNoInicio(linha, anoRef);
    const resto = data ? linha.slice(data.tamanho) : linha;
    const valores = [...resto.matchAll(VALOR_RE)];
    if (valores.length === 0) continue;

    const ehPago = PAGO_RE.test(resto);
    if (!ehPago && NAO_E_LANCAMENTO_RE.test(resto)) continue;
    // Sem data só vale o pagamento e o encargo/imposto (o resto sem data é quadro ou resumo).
    if (!data && !ehPago && !CARGO_RE.test(resto)) continue;
    const date: string | null = data ? ajustarAno(data.iso, data.temAno) : (ultimaData ?? referencia);
    if (!date) continue;
    if (data) ultimaData = date;

    const ultimo = valores[valores.length - 1];
    const magnitude = Math.abs(numeroArgentino(ultimo[2]));
    if (!(magnitude > 0)) continue;
    const credito = ultimo[1] === "-" || Boolean(ultimo[3]);
    const emDolar = DOLAR_RE.test(resto) && !/\bpesos\b/i.test(resto);
    const { descricao, cuota } = limparDescricao(resto.replace(DOLAR_RE, " USD "));
    if (ehPago) {
      lidas.push({ date, descricao: `Pagamento da fatura anterior · ${descricao}`, valor: -magnitude, emDolar });
      continue;
    }
    const nome = [descricao.replace(/\bUSD\b\s*$/i, "").trim() || "Lançamento", cuota].filter(Boolean).join(" ");
    lidas.push({ date, descricao: nome, valor: credito ? -magnitude : magnitude, emDolar });
  }
  return lidas.filter((l) => !l.emDolar).map(({ date, descricao, valor }) => ({ date, description: descricao, amount: Math.round(valor * 100) / 100 }));
}

/** As compras em dólar do resumen, que a leitura em pesos deixa de fora (pra avisar, não pra somar). */
export function comprasEmDolarDoResumen(texto: string): number {
  const linhas = texto.replace(MENOS, "-").split(/\r?\n/);
  const temValor = (l: string) => [...l.matchAll(VALOR_RE)].length > 0;
  return linhas.filter((l) => dataArgentinaNoInicio(l.trim(), 2000) && DOLAR_RE.test(l) && temValor(l) && !PAGO_RE.test(l)).length;
}

/**
 * O que as linhas do mês em pesos têm que somar, pelo resumo: SALDO ACTUAL $ − SALDO ANTERIOR +
 * SU PAGO EN PESOS. É a conferência (conferencia.ts) da fatura argentina.
 */
export function totalDoMesEmPesos(texto: string): number | null {
  const t = texto.replace(MENOS, "-");
  const achar = (re: RegExp) => {
    const m = t.match(re);
    return m ? Math.abs(numeroArgentino(m[1])) : null;
  };
  const NUM = String.raw`\$?\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}-?)`;
  const actual = achar(new RegExp(String.raw`saldo\s+actual\s*(?:en\s+pesos\s*)?\$\s*:?\s*${NUM}`, "i"));
  if (actual === null) return null;
  const anterior = achar(new RegExp(String.raw`saldo\s+anterior\s*(?:\$\s*)?:?\s*${NUM}`, "i")) ?? 0;
  const pago = achar(new RegExp(String.raw`su\s+pago\s+en\s+pesos\s*:?\s*${NUM}`, "i")) ?? 0;
  const doMes = Math.round((actual - anterior + pago) * 100) / 100;
  return doMes > 0 ? doMes : null;
}
