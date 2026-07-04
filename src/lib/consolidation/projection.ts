import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly, nominalToReal } from "@/lib/finance/rate-conversion";
import { fv } from "@/lib/finance/fv";

export type ProjectionInput = {
  currentAge: number;
  retirementAge: number;
  lifeExpectancyAge?: number | null;
  currentPatrimony: number;
  monthlyContributionAccumulation: number;
  accumulationAnnualRate: number;
  inflationAnnualRate: number;
  usufructAnnualRate: number;
  desiredPassiveIncome: number;
  otherPassiveIncome: number;
};

export type ProjectionYear = {
  year: number;
  age: number;
  phase: "ACCUMULATION" | "DRAWDOWN";
  /** Só definido na fase de acúmulo (a planilha original não modela saldo nominal no usufruto). */
  balanceNominal: number | null;
  /** Linha principal do gráfico: patrimônio em termos reais, contínua entre as duas fases. */
  balanceReal: number;
  totalInvested: number | null;
  cumulativeInterest: number | null;
};

/**
 * Equivalente a "Base Dash acum": projeta o patrimônio ano a ano, cobrindo a fase de
 * acúmulo (até a idade objetivo) e, se a expectativa de vida for informada, a fase de
 * usufruto (patrimônio = anterior + renda gerada - gasto, mostrando se sustenta ou se esgota).
 */
export function computeYearByYearProjection(input: ProjectionInput): ProjectionYear[] {
  const accumulationYears = Math.max(input.retirementAge - input.currentAge, 0);
  const nominalAnnual = new Decimal(input.accumulationAnnualRate);
  const realAnnual = nominalToReal(nominalAnnual, input.inflationAnnualRate);
  const nominalMonthly = annualToMonthly(nominalAnnual);
  const realMonthly = annualToMonthly(realAnnual);

  const years: ProjectionYear[] = [];

  for (let yearIndex = 1; yearIndex <= accumulationYears; yearIndex += 1) {
    const months = yearIndex * 12;
    const totalAccumulatedNominal = fv(nominalMonthly, months, input.monthlyContributionAccumulation, input.currentPatrimony);
    const totalAccumulatedReal = fv(realMonthly, months, input.monthlyContributionAccumulation, input.currentPatrimony);
    const totalInvested = new Decimal(input.monthlyContributionAccumulation)
      .times(12)
      .times(yearIndex)
      .plus(input.currentPatrimony);

    years.push({
      year: yearIndex,
      age: input.currentAge + yearIndex,
      phase: "ACCUMULATION",
      balanceNominal: totalAccumulatedNominal.toNumber(),
      balanceReal: totalAccumulatedReal.toNumber(),
      totalInvested: totalInvested.toNumber(),
      cumulativeInterest: totalAccumulatedNominal.minus(totalInvested).toNumber(),
    });
  }

  const lifeExpectancyAge = input.lifeExpectancyAge;
  if (lifeExpectancyAge && lifeExpectancyAge > input.retirementAge) {
    const drawdownYears = lifeExpectancyAge - input.retirementAge;
    const annualWithdrawal = new Decimal(input.desiredPassiveIncome).minus(input.otherPassiveIncome).times(12);
    let balance = years.length > 0 ? new Decimal(years[years.length - 1].balanceReal) : new Decimal(input.currentPatrimony);

    for (let yearIndex = 1; yearIndex <= drawdownYears; yearIndex += 1) {
      const yieldEarned = balance.times(input.usufructAnnualRate);
      balance = Decimal.max(balance.plus(yieldEarned).minus(annualWithdrawal), 0);

      years.push({
        year: accumulationYears + yearIndex,
        age: input.retirementAge + yearIndex,
        phase: "DRAWDOWN",
        balanceNominal: null,
        balanceReal: balance.toNumber(),
        totalInvested: null,
        cumulativeInterest: null,
      });
    }
  }

  return years;
}
