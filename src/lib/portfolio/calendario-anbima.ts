/**
 * Dias úteis do mercado brasileiro (calendário de feriados nacionais da ANBIMA), para contar os
 * "dias úteis / 252" do prefixado e do IPCA+ (lib/portfolio/rendimento-renda-fixa.ts).
 *
 * Feriados nacionais: 1º de janeiro, Carnaval (segunda e terça), Sexta-feira Santa, Tiradentes
 * (21/4), Dia do Trabalho (1/5), Corpus Christi, Independência (7/9), Nossa Senhora Aparecida
 * (12/10), Finados (2/11), Proclamação da República (15/11), Consciência Negra (20/11, nacional
 * desde 2024, lei 14.759/2023) e Natal (25/12). Carnaval e Corpus Christi não são feriados por
 * lei, mas a ANBIMA e a B3 não abrem: o CDI não tem esses dias (conferido com a série 12 do BC).
 *
 * As datas são "dias" inteiros: dias desde 01/01/1970 em UTC (o formato das colunas @db.Date).
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Date (meia-noite UTC ou qualquer hora) → número do dia em UTC. */
export function diaDe(d: Date): number {
  return Math.floor(d.getTime() / DIA_MS);
}

/** Número do dia → Date à meia-noite UTC. */
export function dataDoDia(dia: number): Date {
  return new Date(dia * DIA_MS);
}

/** O dia de (ano, mês 1 a 12, dia). */
export function dia(ano: number, mes: number, d: number): number {
  return diaDe(new Date(Date.UTC(ano, mes - 1, d)));
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): number {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const diaDoMes = ((h + l - 7 * m + 114) % 31) + 1;
  return dia(ano, mes, diaDoMes);
}

const cache = new Map<number, Set<number>>();

/** Os feriados nacionais (ANBIMA) de um ano, como números de dia. */
export function feriadosDoAno(ano: number): Set<number> {
  const pronto = cache.get(ano);
  if (pronto) return pronto;
  const p = pascoa(ano);
  const lista = [
    dia(ano, 1, 1),
    p - 48, // segunda de Carnaval
    p - 47, // terça de Carnaval
    p - 2, // Sexta-feira Santa
    dia(ano, 4, 21),
    dia(ano, 5, 1),
    p + 60, // Corpus Christi
    dia(ano, 9, 7),
    dia(ano, 10, 12),
    dia(ano, 11, 2),
    dia(ano, 11, 15),
    dia(ano, 12, 25),
  ];
  if (ano >= 2024) lista.push(dia(ano, 11, 20));
  const s = new Set(lista);
  cache.set(ano, s);
  return s;
}

/** Dia útil: de segunda a sexta e fora dos feriados nacionais. */
export function ehDiaUtil(d: number): boolean {
  const semana = (d + 4) % 7; // 01/01/1970 foi quinta (4); 0 = domingo
  if (semana === 0 || semana === 6) return false;
  return !feriadosDoAno(dataDoDia(d).getUTCFullYear()).has(d);
}

/**
 * Quantos dias úteis em [desde, ate): o dia da compra conta, o dia final não (é a convenção do
 * mercado, a mesma da calculadora do Tesouro). ate <= desde devolve 0.
 */
export function diasUteis(desde: number, ate: number): number {
  let n = 0;
  for (let d = desde; d < ate; d++) if (ehDiaUtil(d)) n++;
  return n;
}
