import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/**
 * Aporte/parcela periódica necessária para sair de um valor presente e atingir um valor
 * futuro alvo em N períodos, a uma taxa fixa. Segue a mesma equação de fv.ts, então o sinal
 * do resultado indica a direção do fluxo: positivo quando o aporte ENGORDA o saldo (ex.:
 * metas, reserva de emergência, futureValue > presentValue); negativo quando o "aporte"
 * na verdade DRENA o saldo até zerá-lo (ex.: parcela de um financiamento Price, onde
 * presentValue é o saldo devedor e futureValue = 0). Quem for exibir a parcela de um
 * financiamento ao usuário deve usar `.abs()` no resultado, o sinal negativo aqui é
 * informação real (mesma direção usada por fv()), não um bug.
 *
 * @param rate taxa por período
 * @param nper número de períodos
 * @param presentValue valor presente (ex.: valor já guardado, ou saldo financiado)
 * @param futureValue valor futuro alvo (padrão 0, ex.: financiamento quitado)
 * @param type 0 = aporte/parcela no fim do período (padrão), 1 = no início do período
 */
export function pmt(
  rate: DecimalInput,
  nper: DecimalInput,
  presentValue: DecimalInput,
  futureValue: DecimalInput = 0,
  type: 0 | 1 = 0,
): Decimal {
  const r = toDecimal(rate);
  const n = toDecimal(nper);
  const pv = toDecimal(presentValue);
  const fv = toDecimal(futureValue);

  if (r.isZero()) {
    return fv.minus(pv).div(n);
  }

  const growth = r.plus(1).pow(n);
  const annuityFactor = growth.minus(1).div(r).times(r.times(type).plus(1));
  return fv.minus(pv.times(growth)).div(annuityFactor);
}
