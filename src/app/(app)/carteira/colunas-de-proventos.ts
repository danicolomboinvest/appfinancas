import { tickerValido } from "@/lib/analysis/tipo-do-ticker";

/**
 * As colunas de proventos no detalhe do ativo: os 11 meses que terminam no mês de hoje (o
 * resumirProventos devolve 10 meses antes deste, este e o próximo).
 *
 * Antes eram as 10 últimas dessas 11 colunas com os rótulos de um mês antes: em outubro, a primeira
 * barra era janeiro com o rótulo "dez", e o provento de dezembro sumia do gráfico, embora entrasse
 * no total "em 12 meses" logo acima (14/10/2026).
 */
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const MESES_NO_DETALHE = 11;

/** Recebido em cada mês, do mais antigo até o mês de hoje. */
export function colunasDoDetalhe(meses: { recebido: number }[]): number[] {
  return meses.slice(0, MESES_NO_DETALHE).map((m) => m.recebido);
}

/** Os rótulos das pontas do gráfico: o primeiro mês e o mês de hoje. */
export function rotulosDasPontas(hoje: Date): [string, string] {
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - (MESES_NO_DETALHE - 1), 1);
  return [MES[primeiro.getMonth()], MES[hoje.getMonth()]];
}

/** "Ver análise" no detalhe do ativo abre a análise DELE (antes caía na lista de Análises). */
export function linkDaAnalise(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return tickerValido(t) ? `/fichas/ativo/${t}` : "/fichas";
}
