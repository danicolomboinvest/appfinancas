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
  /**
   * Ganho de amortizar medido na mesma régua do investimento: as parcelas que deixam de sair
   * do bolso, reinvestidas à taxa líquida até o fim do prazo original, menos o valor extra.
   */
  amortizeGain: number;
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
 * "Sobrou dinheiro: amortizo o financiamento ou invisto?" Compara o ganho de uma amortização
 * extraordinária (reduzindo o prazo, mantendo a parcela/amortização original) contra o ganho
 * líquido de IR de investir o mesmo valor pelo prazo restante — os dois medidos no fim do
 * prazo original, com o mesmo dinheiro rendendo à mesma taxa.
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

  // A soma nominal dos juros economizados não pode ser comparada com o ganho COMPOSTO do
  // investimento: a economia chega aos poucos (mês a mês no SAC, só no fim no Price) e, somada
  // sem render, perde sempre — mesmo com CET acima da taxa líquida. A comparação justa leva
  // cada parcela que deixa de sair do bolso ao mês N, rendendo à mesma taxa líquida. Se o extra
  // for maior que o saldo, a sobra também fica investida desde o início.
  const leftover = Decimal.max(new Decimal(input.extraAmount).minus(input.outstandingBalance), 0);
  let amortizeFutureValue = leftover;
  for (let i = 0; i < input.remainingMonths; i += 1) {
    const freedPayment = new Decimal(scheduleWithoutExtra[i]?.payment ?? 0).minus(scheduleWithExtra[i]?.payment ?? 0);
    amortizeFutureValue = amortizeFutureValue.times(netInvestmentMonthlyRate.plus(1)).plus(freedPayment);
  }
  const amortizeGain = amortizeFutureValue.minus(input.extraAmount);

  // Diferença abaixo de meio centavo é empate: com juros 0% e rendimento 0% os dois caminhos
  // dão o mesmo, mas o ruído de ponto flutuante (8e-13) decidia o veredito e aparecia como
  // "diferença a favor". No empate a diferença é zero e o desempate continua indo pra amortizar.
  const rawDifference = amortizeGain.minus(investmentGain);
  const empate = rawDifference.abs().lessThan(0.005);
  const winner = empate || rawDifference.greaterThan(0) ? "AMORTIZAR" : "INVESTIR";
  const differenceInFavorOfWinner = empate ? new Decimal(0) : rawDifference.abs();

  return {
    scheduleWithoutExtra,
    scheduleWithExtra,
    totalInterestWithoutExtra: totalInterestWithoutExtra.toNumber(),
    totalInterestWithExtra: totalInterestWithExtra.toNumber(),
    interestSavings: interestSavings.toNumber(),
    amortizeGain: amortizeGain.toNumber(),
    netInvestmentAnnualRate: netInvestmentAnnualRate.toNumber(),
    investmentGain: investmentGain.toNumber(),
    winner,
    differenceInFavorOfWinner: differenceInFavorOfWinner.toNumber(),
  };
}
