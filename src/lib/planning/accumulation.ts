import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly, nominalToReal } from "@/lib/finance/rate-conversion";
import { fv } from "@/lib/finance/fv";

export type AccumulationInput = {
  currentAge: number;
  retirementAge: number;
  currentPatrimony: number;
  monthlyContributionAccumulation: number;
  /** Taxa nominal anual assumida para a fase de acúmulo. */
  accumulationAnnualRate: number;
  inflationAnnualRate: number;
};

export type AccumulationResult = {
  years: number;
  months: number;
  nominalAnnualRate: number;
  realAnnualRate: number;
  finalValueNominal: number;
  finalValueReal: number;
  totalInvested: number;
  totalReturn: number;
};

/**
 * Fase de acúmulo do Planejamento Financeiro: capitaliza o patrimônio inicial + aportes
 * mensais, rodando duas vezes — uma com a taxa nominal, outra com a taxa real (Fisher) —
 * para separar o efeito da inflação do retorno de fato.
 */
export function computeAccumulation(input: AccumulationInput): AccumulationResult {
  const years = Math.max(input.retirementAge - input.currentAge, 0);
  const months = years * 12;

  const nominalAnnual = new Decimal(input.accumulationAnnualRate);
  const realAnnual = nominalToReal(nominalAnnual, input.inflationAnnualRate);

  const nominalMonthly = annualToMonthly(nominalAnnual);
  const realMonthly = annualToMonthly(realAnnual);

  const finalValueNominal = fv(nominalMonthly, months, input.monthlyContributionAccumulation, input.currentPatrimony);
  const finalValueReal = fv(realMonthly, months, input.monthlyContributionAccumulation, input.currentPatrimony);

  const totalInvested = new Decimal(input.monthlyContributionAccumulation)
    .times(12)
    .times(years)
    .plus(input.currentPatrimony);
  const totalReturn = finalValueNominal.minus(totalInvested);

  return {
    years,
    months,
    nominalAnnualRate: nominalAnnual.toNumber(),
    realAnnualRate: realAnnual.toNumber(),
    finalValueNominal: finalValueNominal.toNumber(),
    finalValueReal: finalValueReal.toNumber(),
    totalInvested: totalInvested.toNumber(),
    totalReturn: totalReturn.toNumber(),
  };
}
