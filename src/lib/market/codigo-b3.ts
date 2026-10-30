/**
 * Código de negociação da B3 (PETR4, B3SA3, MXRF11, M1TA34): 4 caracteres + 1 ou 2 dígitos. Os 4
 * primeiros são letras, ou letra, número e duas letras (B3SA3 e os BDRs como M1TA34). Um lugar só
 * para isso: a regra antiga (4 letras seguidas) não reconhecia B3SA3, a ação mais negociada, que
 * entrava como renda fixa, sem cotação, sem análise e sem proventos. Leva de 14/10/2026.
 */
export const CODIGO_B3_FONTE = String.raw`(?:[A-Z]{4}|[A-Z]\d[A-Z]{2})\d{1,2}`;

const CODIGO_B3 = new RegExp(`^${CODIGO_B3_FONTE}$`);
const CODIGO_B3_FII = /^[A-Z]{4}11$/;

/** O texto inteiro é um código de bolsa da B3 (já em maiúsculas, sem espaços). */
export function ehCodigoB3(ticker: string): boolean {
  return CODIGO_B3.test(ticker);
}

/** Código no formato de FII ou ETF da B3 (4 letras + 11). Units também têm esse formato. */
export function formatoDe11(ticker: string): boolean {
  return CODIGO_B3_FII.test(ticker);
}

/**
 * Units são ações da B3 que terminam em 11 (TAEE11, KLBN11), não fundos imobiliários. Lista das
 * mais negociadas; a que não está aqui continua sendo lida como FII, e a seção do extrato (quando
 * existe) corrige.
 */
export const UNITS_B3: ReadonlySet<string> = new Set([
  "TAEE11", "KLBN11", "SANB11", "BPAC11", "ENGI11", "ALUP11", "SAPR11", "IGTI11",
]);
