import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import { generateAmortizationSchedule, type AmortizationSystem } from "@/lib/finance/amortization";

export type FinancingVsRentInput = {
  propertyValue: number;
  downPayment: number;
  cetAnnualRate: number;
  propertyAppreciationAnnualRate: number;
  termMonths: number;
  system: AmortizationSystem;
  monthlyRent: number;
  rentAnnualAdjustment: number;
  investmentAnnualRate: number;
};

export type FinancingVsRentMonth = {
  month: number;
  installment: number;
  rent: number;
  propertyValue: number;
  outstandingBalance: number;
  financingPatrimony: number;
  investedPatrimony: number;
};

export type FinancingVsRentResult = {
  financedAmount: number;
  schedule: FinancingVsRentMonth[];
  finalFinancingPatrimony: number;
  finalInvestedPatrimony: number;
  winner: "FINANCIAR" | "ALUGAR_E_INVESTIR";
};

/**
 * Financiar vs Alugar+Investir: monta a amortização do financiamento e, em paralelo, simula
 * quem aluga investindo a diferença entre a parcela e o aluguel — incluindo a entrada que
 * não seria gasta, para uma comparação justa entre os dois caminhos.
 */
export function simulateFinancingVsRent(input: FinancingVsRentInput): FinancingVsRentResult {
  const financedAmount = input.propertyValue - input.downPayment;
  const monthlyRate = annualToMonthly(input.cetAnnualRate);
  const appreciationMonthly = annualToMonthly(input.propertyAppreciationAnnualRate);
  const investmentMonthly = annualToMonthly(input.investmentAnnualRate);

  const amortizationRows = generateAmortizationSchedule({
    system: input.system,
    principal: financedAmount,
    monthlyRate,
    months: input.termMonths,
  });

  const schedule: FinancingVsRentMonth[] = [];
  let propertyValue = new Decimal(input.propertyValue);
  let investedBalance = new Decimal(input.downPayment);
  let rent = new Decimal(input.monthlyRent);

  for (const row of amortizationRows) {
    propertyValue = propertyValue.times(appreciationMonthly.plus(1));
    if (row.month > 1 && (row.month - 1) % 12 === 0) {
      rent = rent.times(new Decimal(input.rentAnnualAdjustment).plus(1));
    }
    const surplus = new Decimal(row.payment).minus(rent);
    investedBalance = investedBalance.times(investmentMonthly.plus(1)).plus(surplus);

    schedule.push({
      month: row.month,
      installment: row.payment,
      rent: rent.toNumber(),
      propertyValue: propertyValue.toNumber(),
      outstandingBalance: row.balance,
      financingPatrimony: propertyValue.minus(row.balance).toNumber(),
      investedPatrimony: investedBalance.toNumber(),
    });
  }

  const last = schedule[schedule.length - 1];

  return {
    financedAmount,
    schedule,
    finalFinancingPatrimony: last.financingPatrimony,
    finalInvestedPatrimony: last.investedPatrimony,
    winner: last.financingPatrimony >= last.investedPatrimony ? "FINANCIAR" : "ALUGAR_E_INVESTIR",
  };
}
