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
  /** Juros do cenário NOMINAL: só fecha com finalValueNominal. */
  totalReturn: number;
  /** Juros do cenário REAL: é o que fecha com finalValueReal e com totalInvested. */
  totalReturnReal: number;
};

/**
 * Fase de acúmulo: capitaliza o patrimônio inicial + aportes mensais duas vezes, uma com a
 * taxa nominal e outra com a taxa real (Fisher).
 *
 * ATENÇÃO — são DOIS CENÁRIOS DIFERENTES, não duas vistas do mesmo, e confundir os dois já
 * gerou número errado na tela:
 *
 * - NOMINAL: a pessoa aporta o mesmo valor de face até o fim (R$ 1.000 em 2064 também), e o
 *   resultado sai em dinheiro do futuro.
 * - REAL: o mesmo aporte roda à taxa real, o que equivale a dizer que ela REAJUSTA o aporte
 *   pela inflação (R$ 1.000 de hoje todo mês), e o resultado sai em dinheiro de hoje.
 *
 * Por isso `finalValueReal` NÃO é `finalValueNominal` descontado pela inflação — com 38 anos,
 * 12% a.a. e 4,5% de inflação a diferença passa de 35%. Cada valor final só pode ser somado,
 * subtraído ou comparado com os juros do MESMO cenário, daí existirem `totalReturn` (nominal)
 * e `totalReturnReal`. `totalInvested` serve aos dois: no nominal é o valor de face que saiu
 * do bolso, no real é o mesmo número lido em dinheiro de hoje.
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
  const totalReturnReal = finalValueReal.minus(totalInvested);

  return {
    years,
    months,
    nominalAnnualRate: nominalAnnual.toNumber(),
    realAnnualRate: realAnnual.toNumber(),
    finalValueNominal: finalValueNominal.toNumber(),
    finalValueReal: finalValueReal.toNumber(),
    totalInvested: totalInvested.toNumber(),
    totalReturn: totalReturn.toNumber(),
    totalReturnReal: totalReturnReal.toNumber(),
  };
}
