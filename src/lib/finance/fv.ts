import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/**
 * Valor futuro de um capital inicial mais aportes periódicos, capitalizados a uma taxa fixa.
 *
 * Convenção deste motor (diferente do Excel/Sheets): pv, pmt e o resultado são todos
 * magnitudes positivas na mesma direção (ex.: "quanto dinheiro eu tenho/aporto/acumulo"),
 * em vez da convenção de sinais alternados do Excel (entrada vs. saída de caixa).
 *
 * @param rate taxa por período (ex.: taxa mensal se nper está em meses)
 * @param nper número de períodos
 * @param pmt aporte periódico
 * @param pv valor inicial (presente)
 * @param type 0 = aporte no fim do período (padrão), 1 = aporte no início do período
 */
export function fv(
  rate: DecimalInput,
  nper: DecimalInput,
  pmt: DecimalInput,
  pv: DecimalInput,
  type: 0 | 1 = 0,
): Decimal {
  const r = toDecimal(rate);
  const n = toDecimal(nper);
  const p = toDecimal(pmt);
  const initial = toDecimal(pv);

  if (r.isZero()) {
    return initial.plus(p.times(n));
  }

  const growth = r.plus(1).pow(n);
  const annuityFactor = growth.minus(1).div(r).times(r.times(type).plus(1));
  return initial.times(growth).plus(p.times(annuityFactor));
}
