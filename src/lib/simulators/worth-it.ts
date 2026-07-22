import { Decimal, fv, annualToMonthly } from "@/lib/finance";

export type WorthItMode = "SINGLE" | "RECURRING";

export type WorthItInput = {
  price: number;
  monthlyIncome: number;
  mode: WorthItMode;
  horizonYears: number;
};

export type WorthItResult = {
  hourlyRate: number;
  /** null quando não há renda cadastrada para calcular o valor-hora. */
  hoursEquivalent: number | null;
  futureValueIfInvested: number;
  totalInvested: number;
  difference: number;
};

const HOURS_PER_MONTH = 220;

/** Taxa anual assumida para o valor investido, nominal, sem descontar inflação ou impostos. */
export const WORTH_IT_ANNUAL_RATE = 0.12;

/**
 * Compara o preço de uma compra com (a) o tempo de trabalho equivalente, dado a renda
 * mensal do usuário, e (b) o valor futuro se esse dinheiro fosse investido em vez de gasto.
 * "RECURRING" trata o preço como um aporte mensal (ex.: uma assinatura) em vez de um valor
 * único, mesma convenção de fv() do motor financeiro (pv e pmt como magnitudes positivas).
 */
export function simulateWorthIt(input: WorthItInput): WorthItResult {
  const hourlyRate = new Decimal(input.monthlyIncome).div(HOURS_PER_MONTH);
  const hoursEquivalent = hourlyRate.greaterThan(0) ? new Decimal(input.price).div(hourlyRate).toNumber() : null;

  const monthlyRate = annualToMonthly(WORTH_IT_ANNUAL_RATE);
  const months = input.horizonYears * 12;

  const futureValue =
    input.mode === "SINGLE" ? fv(monthlyRate, months, 0, input.price) : fv(monthlyRate, months, input.price, 0);
  const totalInvested = input.mode === "SINGLE" ? new Decimal(input.price) : new Decimal(input.price).times(months);

  return {
    hourlyRate: hourlyRate.toNumber(),
    hoursEquivalent,
    futureValueIfInvested: futureValue.toNumber(),
    totalInvested: totalInvested.toNumber(),
    difference: futureValue.minus(totalInvested).toNumber(),
  };
}
