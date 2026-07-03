import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/**
 * Número de períodos necessários para sair de um valor presente e atingir um valor futuro
 * alvo, dado um aporte periódico fixo e uma taxa fixa. Mesma convenção de sinais de fv.ts.
 *
 * @param rate taxa por período
 * @param pmt aporte periódico
 * @param presentValue valor presente (ex.: reserva atual, valor já guardado de uma meta)
 * @param futureValue valor futuro alvo
 * @param type 0 = aporte no fim do período (padrão), 1 = no início do período
 */
export function nper(
  rate: DecimalInput,
  pmt: DecimalInput,
  presentValue: DecimalInput,
  futureValue: DecimalInput,
  type: 0 | 1 = 0,
): Decimal {
  const r = toDecimal(rate);
  const p = toDecimal(pmt);
  const pv = toDecimal(presentValue);
  const fv = toDecimal(futureValue);

  if (r.isZero()) {
    return fv.minus(pv).div(p);
  }

  const dueFactor = r.times(type).plus(1);
  const numerator = fv.times(r).plus(p.times(dueFactor));
  const denominator = pv.times(r).plus(p.times(dueFactor));
  return numerator.div(denominator).ln().div(r.plus(1).ln());
}
