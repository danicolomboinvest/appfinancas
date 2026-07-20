import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/**
 * Valor presente necessário hoje, dado um valor futuro alvo e aportes periódicos.
 * Mesma convenção de sinais positivos descrita em fv.ts.
 *
 * @param rate taxa por período
 * @param nper número de períodos
 * @param pmt aporte periódico
 * @param futureValue valor futuro alvo
 * @param type 0 = aporte no fim do período (padrão), 1 = aporte no início do período
 */
export function pv(
  rate: DecimalInput,
  nper: DecimalInput,
  pmt: DecimalInput,
  futureValue: DecimalInput,
  type: 0 | 1 = 0,
): Decimal {
  const r = toDecimal(rate);
  const n = toDecimal(nper);
  const p = toDecimal(pmt);
  const target = toDecimal(futureValue);

  if (r.isZero()) {
    return target.minus(p.times(n));
  }

  const growth = r.plus(1).pow(n);
  const annuityFactor = growth.minus(1).div(r).times(r.times(type).plus(1));
  return target.minus(p.times(annuityFactor)).div(growth);
}

/**
 * Preço de um título prefixado zero-cupom (marcação a mercado): valor de face trazido a
 * valor presente por uma taxa de desconto, sem aportes periódicos.
 * price = faceValue / (1+rate)^time
 *
 * A base (1+rate) tem um piso pequeno e positivo: uma taxa de desconto <= -100% zeraria ou
 * inverteria a base, virando Infinity/NaN na tela do simulador. O formulário já barra isso,
 * mas a matriz de sensibilidade soma variações à taxa internamente — este piso garante que
 * o cálculo nunca quebra mesmo com uma combinação extrema de taxa + variação.
 */
export function bondPrice(faceValue: DecimalInput, rate: DecimalInput, time: DecimalInput): Decimal {
  const base = toDecimal(rate).plus(1);
  const safeBase = base.lte(0) ? new Decimal(0.0001) : base;
  return toDecimal(faceValue).div(safeBase.pow(toDecimal(time)));
}
