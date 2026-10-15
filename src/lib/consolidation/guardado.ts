/**
 * "Guardou no mês", uma regra só (15/10/2026, "as coisas precisam bater certinho").
 *
 * A regra é a do Resumo: a soma LÍQUIDA dos aportes do mês (os lançamentos INVESTMENT_CONTRIBUTION,
 * com o resgate entrando negativo), no escopo dos totais (no casal, os dois). É o mesmo número
 * que fecha o sobrou (entrou − gastou − guardou).
 *
 * Antes a Carteira dizia max(líquido, aportes positivos até hoje): aportou R$ 1.000 e resgatou
 * R$ 400, o Resumo dizia "Guardou R$ 600" e a Carteira "você guardou R$ 1.000".
 */
export function guardadoDoMes(resumo: { totalInvestment: number }): number {
  return Math.round(resumo.totalInvestment * 100) / 100 || 0;
}
