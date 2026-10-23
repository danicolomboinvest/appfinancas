/**
 * Extrato em PDF de banco europeu (euro): o texto traz o dinheiro e a data do jeito de lá, e os
 * leitores do app foram feitos para o jeito daqui ("1.234,56", "01/10/2026", "out").
 *
 *   1 Oct 2026  Lidl Berlin  €23.45  €976.55          → inglês: ponto no centavo, mês por nome
 *   01.10.2026  REWE Markt  -34,20 €  965,80 €         → alemão: ponto na data, € no fim
 *   1 de out. de 2026  Lidl  23,45 €  976,55 €         → Revolut em português
 *
 * Em vez de ensinar cada leitor a falar euro, o texto é traduzido para o jeito do app e passa
 * pelos mesmos leitores. Só é usado quando os leitores normais não leram NADA: nenhum documento
 * que já funciona muda.
 */

/** Mês (inglês, espanhol, italiano, alemão, francês, português) → abreviação que os leitores entendem. */
const MES_PARA_PT: Record<string, string> = {
  jan: "jan", january: "jan", janv: "jan", janvier: "jan", januar: "jan", ene: "jan", enero: "jan", gen: "jan", gennaio: "jan", janeiro: "jan",
  feb: "fev", february: "fev", févr: "fev", fevr: "fev", février: "fev", febrero: "fev", febbraio: "fev", februar: "fev", fev: "fev", fevereiro: "fev",
  mar: "mar", march: "mar", mars: "mar", marzo: "mar", märz: "mar", mär: "mar", maerz: "mar", março: "mar", marco: "mar",
  apr: "abr", april: "abr", avr: "abr", avril: "abr", abr: "abr", abril: "abr", aprile: "abr",
  may: "mai", mai: "mai", mayo: "mai", maio: "mai", mag: "mai", maggio: "mai",
  jun: "jun", june: "jun", juin: "jun", junio: "jun", juni: "jun", giu: "jun", giugno: "jun", junho: "jun",
  jul: "jul", july: "jul", juil: "jul", juillet: "jul", julio: "jul", juli: "jul", lug: "jul", luglio: "jul", julho: "jul",
  aug: "ago", august: "ago", août: "ago", aout: "ago", ago: "ago", agosto: "ago",
  sep: "set", sept: "set", september: "set", septembre: "set", septiembre: "set", setiembre: "set", settembre: "set", set: "set", setembro: "set",
  oct: "out", october: "out", octobre: "out", octubre: "out", okt: "out", oktober: "out", ott: "out", ottobre: "out", out: "out", outubro: "out",
  nov: "nov", november: "nov", novembre: "nov", noviembre: "nov", novembro: "nov",
  dec: "dez", december: "dez", déc: "dez", décembre: "dez", decembre: "dez", dic: "dez", diciembre: "dez", dicembre: "dez", dez: "dez", dezember: "dez", dezembro: "dez",
};

const MES_NOME = Object.keys(MES_PARA_PT).sort((a, b) => b.length - a.length).join("|");
/** "1 Oct 2026", "01. Oktober 2026", "1 de out. de 2026", "Oct 1, 2026" não entra (nenhum banco europeu usa). */
const DATA_POR_NOME_RE = new RegExp(String.raw`(?<![\dA-Za-zÀ-ÿ])(\d{1,2})\.?[ \t]+(?:de[ \t]+)?(${MES_NOME})\.?(?:[ \t]+de)?[ \t]+(\d{4})(?![\dA-Za-zÀ-ÿ])`, "gi");
/** "01.10.2026", "01.10.26" e "01.10." (sem ano): data alemã/portuguesa com ponto. */
const DATA_COM_PONTO_RE = /(?<![\d.,])(\d{2})\.(\d{2})\.(\d{4}|\d{2})?(?![\d]|[.,]\d)/g;
/** Dinheiro no jeito inglês: "1,234.56", "23.45". Nada de dígito, ponto ou vírgula colado dos lados. */
/** "01.10 01.10 COMPRA ..." no começo da linha (dia e mês, sem ano): extrato português com data do movimento e do valor. */
const DATA_SEM_ANO_NO_INICIO_RE = /^([ \t]*)(\d{2})\.(\d{2})(?=[ \t]+(?:\d{2}\.\d{2}[ \t]|[A-Za-zÀ-ÿ]))/gm;
const DINHEIRO_INGLES_RE = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})(?![\d]|[.,]\d)/g;
const DINHEIRO_BR_RE = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)/g;

export function normalizarTextoEuropeu(texto: string): string | null {
  let t = texto;
  // 1. Datas por extenso e com ponto, antes de mexer nos números (o ponto da data não pode virar vírgula de centavo).
  t = t.replace(DATA_POR_NOME_RE, (_m, d: string, mes: string, ano: string) => `${d.padStart(2, "0")} ${MES_PARA_PT[mes.toLowerCase()]} ${ano}`);
  t = t.replace(DATA_COM_PONTO_RE, (_m, d: string, mes: string, ano?: string) => (ano ? `${d}/${mes}/${ano}` : `${d}/${mes}`));
  t = t.replace(DATA_SEM_ANO_NO_INICIO_RE, "$1$2/$3");
  t = t.replace(/(?<=\d{2}\/\d{2}[ \t])(\d{2})\.(\d{2})(?=[ \t])/g, "$1/$2");
  // 2. A moeda sai do caminho: "€23.45", "23,45 €", "23,45 EUR".
  t = t.replace(/€[ \t]?/g, "").replace(/(?<=\d)[ \t]?€/g, "").replace(/(?<=\d)[ \t]+EUR\b/g, "").replace(/\bEUR[ \t]+(?=-?\d)/g, "");
  // 3. Dinheiro no jeito inglês vira o jeito daqui, mas só se o documento inteiro é assim.
  const ingles = (t.match(DINHEIRO_INGLES_RE) ?? []).length;
  const brasileiro = (t.match(DINHEIRO_BR_RE) ?? []).length;
  if (ingles > brasileiro) {
    t = t.replace(DINHEIRO_INGLES_RE, (_m, inteiro: string, centavos: string) => `${inteiro.replace(/,/g, ".")},${centavos}`);
  }
  return t === texto ? null : t;
}
