import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import { fv } from "@/lib/finance/fv";
import {
  generateAmortizationSchedule,
  totalInterest,
  type AmortizationRow,
  type AmortizationSystem,
} from "@/lib/finance/amortization";

export type AmortizeVsInvestInput = {
  outstandingBalance: number;
  cetAnnualRate: number;
  remainingMonths: number;
  system: AmortizationSystem;
  extraAmount: number;
  investmentAnnualRate: number;
  /** Alíquota de IR sobre o rendimento do investimento, nunca comparar taxa bruta com economia de juros. */
  incomeTaxRate: number;
};

export type AmortizeVsInvestResult = {
  scheduleWithoutExtra: AmortizationRow[];
  scheduleWithExtra: AmortizationRow[];
  totalInterestWithoutExtra: number;
  totalInterestWithExtra: number;
  interestSavings: number;
  netInvestmentAnnualRate: number;
  investmentGain: number;
  winner: "AMORTIZAR" | "INVESTIR";
  differenceInFavorOfWinner: number;
};

/** Roda a amortização com um valor fixo de amortização (SAC) ou parcela (Price) até zerar o saldo. */
function runWithFixedInstallment(
  system: AmortizationSystem,
  startingBalance: number,
  monthlyRate: Decimal,
  fixedValue: Decimal,
  maxMonths: number,
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = new Decimal(startingBalance);

  for (let month = 1; month <= maxMonths && balance.greaterThan(0.005); month += 1) {
    const interest = balance.times(monthlyRate);
    let amortization = system === "SAC" ? fixedValue : fixedValue.minus(interest);
    if (amortization.greaterThan(balance)) amortization = balance;
    const payment = amortization.plus(interest);
    balance = balance.minus(amortization);

    rows.push({
      month,
      payment: payment.toNumber(),
      interest: interest.toNumber(),
      amortization: amortization.toNumber(),
      balance: balance.toNumber(),
    });
  }

  return rows;
}

/**
 * "Sobrou dinheiro: amortizo o financiamento ou invisto?" Compara a economia de juros de
 * uma amortização extraordinária (reduzindo o prazo, mantendo a parcela/amortização
 * original) contra o ganho líquido de IR de investir o mesmo valor pelo prazo restante.
 */
export function simulateAmortizeVsInvest(input: AmortizeVsInvestInput): AmortizeVsInvestResult {
  const monthlyRate = annualToMonthly(input.cetAnnualRate);

  const scheduleWithoutExtra = generateAmortizationSchedule({
    system: input.system,
    principal: input.outstandingBalance,
    monthlyRate,
    months: input.remainingMonths,
  });

  const fixedValue =
    input.system === "SAC"
      ? new Decimal(input.outstandingBalance).div(input.remainingMonths)
      : new Decimal(scheduleWithoutExtra[0]?.payment ?? 0);

  const balanceAfterExtra = Math.max(input.outstandingBalance - input.extraAmount, 0);
  const scheduleWithExtra = runWithFixedInstallment(
    input.system,
    balanceAfterExtra,
    monthlyRate,
    fixedValue,
    input.remainingMonths,
  );

  const totalInterestWithoutExtra = totalInterest(scheduleWithoutExtra);
  const totalInterestWithExtra = totalInterest(scheduleWithExtra);
  const interestSavings = totalInterestWithoutExtra.minus(totalInterestWithExtra);

  const netInvestmentAnnualRate = new Decimal(input.investmentAnnualRate).times(new Decimal(1).minus(input.incomeTaxRate));
  const netInvestmentMonthlyRate = annualToMonthly(netInvestmentAnnualRate);
  const investmentGain = fv(netInvestmentMonthlyRate, input.remainingMonths, 0, input.extraAmount).minus(
    input.extraAmount,
  );

  const winner = interestSavings.greaterThanOrEqualTo(investmentGain) ? "AMORTIZAR" : "INVESTIR";
  const differenceInFavorOfWinner = interestSavings.minus(investmentGain).abs();

  return {
    scheduleWithoutExtra,
    scheduleWithExtra,
    totalInterestWithoutExtra: totalInterestWithoutExtra.toNumber(),
    totalInterestWithExtra: totalInterestWithExtra.toNumber(),
    interestSavings: interestSavings.toNumber(),
    netInvestmentAnnualRate: netInvestmentAnnualRate.toNumber(),
    investmentGain: investmentGain.toNumber(),
    winner,
    differenceInFavorOfWinner: differenceInFavorOfWinner.toNumber(),
  };
}
