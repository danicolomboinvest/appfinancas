/**
 * O básico pra ler extrato e fatura da Argentina (14/10/2026, pedido da Dani depois do peso
 * argentino entrar como moeda): os meses em espanhol, o número com "$" e "U$S", e as palavras que
 * dizem que o arquivo é de lá. Os leitores de cada tipo (resumen de tarjeta, resumen de cuenta)
 * usam isto; o resto do app continua igual pra quem é do Brasil.
 *
 * Tudo aqui foi escrito a partir de documentação e exemplos públicos. Nenhum dado de cliente.
 */

/** Mês em espanhol, abreviado ou inteiro. "sep" e "set" convivem (cada banco abrevia de um jeito). */
export const MESES_ES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, sept: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MES_ES_SRC = "(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sept?(?:iembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)";

/**
 * Data no COMEÇO do texto, nos jeitos que os bancos argentinos escrevem:
 * "15/10/2026", "15/10/26", "15-10-26", "15.10.26", "15-Oct-26", "15 OCT 26", "15-oct-2026",
 * "15 Oct" (sem ano). Sem ano, usa o de referência.
 */
const DATA_NUM_RE = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?!\d)/;
// O mês por extenso, abreviado do jeito de cada banco ("Oct", "Setiem", "Sept."): vale pelas três
// primeiras letras, desde que sejam de um mês.
const DATA_MES_RE = /^(\d{1,2})[\s.\-/]+([a-z]{3,10})\.?(?![a-z])(?:[\s.\-/]+(\d{4}|\d{2})(?!\d))?/i;

export function dataArgentinaNoInicio(texto: string, anoRef: number): { iso: string; tamanho: number; temAno: boolean } | null {
  const t = texto;
  let m = t.match(DATA_NUM_RE);
  if (m) {
    const iso = isoValida(Number(m[1]), Number(m[3]), ano(m[4]));
    return iso ? { iso, tamanho: m[0].length, temAno: true } : null;
  }
  m = t.match(DATA_MES_RE);
  if (m) {
    const mes = mesEs(m[2]);
    if (!mes) return null;
    const iso = isoValida(Number(m[1]), mes, m[3] ? ano(m[3]) : anoRef);
    return iso ? { iso, tamanho: m[0].length, temAno: Boolean(m[3]) } : null;
  }
  return null;
}

/** "oct", "Octubre", "SEPT" → 10, 9; null se não for mês. */
export function mesEs(nome: string): number | null {
  const n = nome.toLowerCase().replace(/\.$/, "");
  if (MESES_ES[n]) return MESES_ES[n];
  // Abreviação que é o começo do nome do mês ("Setiem", "Novi"); "MARTINEZ" não é março.
  if (n.length < 3) return null;
  const inteiro = Object.keys(MESES_ES).find((m) => m.length > 4 && m.startsWith(n));
  return inteiro ? MESES_ES[inteiro] : null;
}

function ano(txt: string): number {
  return txt.length === 2 ? 2000 + Number(txt) : Number(txt);
}

function isoValida(dia: number, mes: number, a: number): string | null {
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && a >= 1990 && a <= 2100)) return null;
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Número de dinheiro argentino: "$ 1.234,56", "-1.234,56", "1.234,56-", "$-1.234,56", "U$S 12,50",
 * "USD 12,50", e o "1234.56" das exportações CSV. Ponto de milhar e vírgula decimal é o normal
 * (igual ao Brasil); quando só tem ponto com 1 ou 2 casas, o ponto é o decimal.
 */
export function numeroArgentino(bruto: string): number {
  let t = bruto.replace(/[−–—]/g, "-").replace(/U\$S|U\$D|USD|ARS|AR\$|\$|\s/gi, "");
  if (!t) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (/\d-$/.test(t)) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith("-")) {
    negativo = !negativo;
    t = t.slice(1);
  }
  if (!/^\d[\d.,]*$/.test(t)) return NaN;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  let n: string;
  if (virgula >= 0 && ponto >= 0) n = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (virgula >= 0) n = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (ponto >= 0) n = /\.\d{1,2}$/.test(t) && !/^\d{1,3}(\.\d{3})+$/.test(t) ? t : t.replace(/\./g, "");
  else n = t;
  const v = Number(n);
  if (!Number.isFinite(v)) return NaN;
  return negativo ? -v : v;
}

/**
 * Palavras que só um documento de banco argentino tem (nenhuma delas aparece num extrato ou numa
 * fatura do Brasil). Precisa de três diferentes: "fecha" sozinha pode ser o nome de uma loja.
 */
const PALAVRAS_DA_ARGENTINA: RegExp[] = [
  /\bresumen\s+de\s+(?:cuenta|tarjeta)\b/i,
  /\bcaja\s+de\s+ahorros?\b/i,
  /\bcuenta\s+corriente\b/i,
  /\bmovimientos\b/i,
  /\bfecha\b/i,
  /\b(?:concepto|descripci[oó]n|detalle\s+de\s+transacci[oó]n)\b/i,
  /\bimporte\b/i,
  /\bcuotas?\b/i,
  /\bvencimiento\b/i,
  /\bcierre\b/i,
  /\bpago\s+m[ií]nimo\b/i,
  /\b(?:cuit|cuil|cbu|cvu)\b/i,
  /\bpercepci[oó]n\b|\bpercep\b/i,
  /\bimpuesto\b|\bimp\.?\s+ley\b/i,
  /\bd[oó]lares\b|\bU\$S\b/,
  /\bpesos\b/i,
  /\bextracci[oó]n\b/i,
  /\btransferencia\s+(?:recibida|enviada|inmediata)\b/i,
  /\b(?:galicia|bbva|franc[eé]s|naci[oó]n|macro|brubank|ual[aá]|naranja|santander\s+r[ií]o|patagonia|credicoop|ciudad|supervielle|icbc|hsbc\s+argentina|banco\s+provincia)\b/i,
  /\bafip\b|\barca\b|\biibb\b|\bingresos\s+brutos\b/i,
];

export function pareceDaArgentina(texto: string): boolean {
  const cabeca = texto.slice(0, 8000);
  let achou = 0;
  for (const re of PALAVRAS_DA_ARGENTINA) if (re.test(cabeca) && ++achou >= 3) return true;
  return false;
}

/**
 * Data do rótulo ("Vencimiento actual: 05-Nov-26", "VENCIMIENTO 05/11/2026", "Cierre actual
 * 23 Oct 26"), na mesma linha ou na de baixo. Vale o primeiro, que é o do topo do resumen.
 */
function dataDoRotulo(texto: string, rotulo: string): string | null {
  const re = new RegExp(String.raw`${rotulo}\s*[:\-]?\s*(?:\n\s*)?(\d{1,2}[\s.\-/]+(?:\d{1,2}|${MES_ES_SRC})\.?[\s.\-/]+(?:\d{4}|\d{2}))(?!\d)`, "i");
  const m = texto.match(re);
  if (!m) return null;
  return dataArgentinaNoInicio(m[1], new Date().getFullYear())?.iso ?? null;
}

/** O vencimento do resumen de tarjeta argentino (o "actual", nunca o "próximo"). */
export function vencimientoArgentino(texto: string): string | null {
  return dataDoRotulo(texto, String.raw`(?<!pr[oó]ximo\s)(?<!prox\.\s)vencimiento(?:\s+actual)?`);
}

/** O fechamento ("cierre") do resumen de tarjeta argentino, o atual. */
export function cierreArgentino(texto: string): string | null {
  return dataDoRotulo(texto, String.raw`(?<!pr[oó]ximo\s)(?<!prox\.\s)cierre(?:\s+actual)?`);
}
