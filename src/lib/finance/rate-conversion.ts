import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/** Converte taxa anual em taxa mensal equivalente: (1+i)^(1/12) - 1 */
export function annualToMonthly(annualRate: DecimalInput): Decimal {
  return toDecimal(annualRate).plus(1).pow(new Decimal(1).div(12)).minus(1);
}

/** Converte taxa mensal em taxa anual equivalente: (1+i)^12 - 1 */
export function monthlyToAnnual(monthlyRate: DecimalInput): Decimal {
  return toDecimal(monthlyRate).plus(1).pow(12).minus(1);
}

/** Converte taxa anual em taxa diária (base 252 dias úteis): (1+i)^(1/252) - 1 */
export function annualToDailyBusiness(annualRate: DecimalInput): Decimal {
  return toDecimal(annualRate).plus(1).pow(new Decimal(1).div(252)).minus(1);
}

/** Converte taxa diária (base 252 dias úteis) em taxa anual: (1+i)^252 - 1 */
export function dailyBusinessToAnnual(dailyRate: DecimalInput): Decimal {
  return toDecimal(dailyRate).plus(1).pow(252).minus(1);
}

/**
 * Fórmula de Fisher: desconta a inflação de uma taxa nominal para obter a taxa real.
 * realRate = (1+nominal)/(1+inflation) - 1
 */
export function nominalToReal(nominalRate: DecimalInput, inflationRate: DecimalInput): Decimal {
  return toDecimal(nominalRate).plus(1).div(toDecimal(inflationRate).plus(1)).minus(1);
}

/**
 * Inverso de Fisher: reconstrói a taxa nominal a partir da taxa real e da inflação.
 * nominalRate = (1+real)*(1+inflation) - 1
 */
export function realToNominal(realRate: DecimalInput, inflationRate: DecimalInput): Decimal {
  return toDecimal(realRate).plus(1).times(toDecimal(inflationRate).plus(1)).minus(1);
}
