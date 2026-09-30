import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import { fv } from "@/lib/finance/fv";
import { generateAmortizationSchedule, totalPaid, type AmortizationSystem } from "@/lib/finance/amortization";

export type ConsortiumVsFinancingInput = {
  /** Valor do bem / carta de crédito. */
  creditValue: number;
  /** Taxa de administração total do consórcio (fração do valor do bem, ex.: 0.18 = 18%). */
  consortiumAdminFeeRate: number;
  consortiumTermMonths: number;
  financingDownPayment: number;
  financingCetAnnualRate: number;
  financingTermMonths: number;
  financingSystem: AmortizationSystem;
  /** Taxa de referência para o custo de oportunidade da entrada do financiamento. */
  opportunityCostAnnualRate: number;
};

export type ConsortiumVsFinancingResult = {
  consortium: {
    totalPaid: number;
    installment: number;
    operationCost: number;
  };
  financing: {
    financedAmount: number;
    totalPaid: number;
    firstInstallment: number;
    operationCost: number;
    downPaymentOpportunityCost: number;
    totalCostWithOpportunity: number;
  };
  winner: "CONSORCIO" | "FINANCIAMENTO";
  differenceInFavorOfWinner: number;
  /** Algum prazo menor que 1 mês (campo zerado ou apagado): não há conta a fazer. */
  invalidTerm: boolean;
};

/**
 * Consórcio vs Financiamento, incluindo a melhoria sugerida no briefing original: o custo
 * de oportunidade da entrada do financiamento (esse dinheiro poderia render se, em vez de
 * financiar, a pessoa tivesse optado pelo consórcio, que não exige entrada).
 */
export function simulateConsortiumVsFinancing(input: ConsortiumVsFinancingInput): ConsortiumVsFinancingResult {
  // Prazo digitado "0" chegava nas contas: o consórcio dividia por zero (parcela infinita na
  // tela) e o financiamento virava tabela vazia com custo negativo, "vencendo" a comparação.
  // Igual ao Financiar vs Alugar: prazo fracionado vira meses inteiros e abaixo de 1 mês não
  // há veredito.
  const consortiumTermMonths = Number.isFinite(input.consortiumTermMonths) ? Math.floor(input.consortiumTermMonths) : 0;
  const financingTermMonths = Number.isFinite(input.financingTermMonths) ? Math.floor(input.financingTermMonths) : 0;
  if (consortiumTermMonths < 1 || financingTermMonths < 1) {
    return {
      consortium: { totalPaid: 0, installment: 0, operationCost: 0 },
      financing: {
        financedAmount: input.creditValue - input.financingDownPayment,
        totalPaid: 0,
        firstInstallment: 0,
        operationCost: 0,
        downPaymentOpportunityCost: 0,
        totalCostWithOpportunity: 0,
      },
      winner: "CONSORCIO",
      differenceInFavorOfWinner: 0,
      invalidTerm: true,
    };
  }

  const consortiumTotalPaid = new Decimal(input.creditValue).times(new Decimal(1).plus(input.consortiumAdminFeeRate));
  const consortiumInstallment = consortiumTotalPaid.div(consortiumTermMonths);
  const consortiumOperationCost = consortiumTotalPaid.minus(input.creditValue);

  const financedAmount = input.creditValue - input.financingDownPayment;
  const financingMonthlyRate = annualToMonthly(input.financingCetAnnualRate);
  const financingSchedule = generateAmortizationSchedule({
    system: input.financingSystem,
    principal: financedAmount,
    monthlyRate: financingMonthlyRate,
    months: financingTermMonths,
  });
  const financingTotalPaid = totalPaid(financingSchedule);
  const financingOperationCost = financingTotalPaid.minus(financedAmount);

  const opportunityMonthlyRate = annualToMonthly(input.opportunityCostAnnualRate);
  const downPaymentOpportunityCost = fv(
    opportunityMonthlyRate,
    financingTermMonths,
    0,
    input.financingDownPayment,
  ).minus(input.financingDownPayment);

  const totalCostWithOpportunity = financingOperationCost.plus(downPaymentOpportunityCost);

  const winner = consortiumOperationCost.lessThanOrEqualTo(totalCostWithOpportunity) ? "CONSORCIO" : "FINANCIAMENTO";
  const differenceInFavorOfWinner = consortiumOperationCost.minus(totalCostWithOpportunity).abs();

  return {
    consortium: {
      totalPaid: consortiumTotalPaid.toNumber(),
      installment: consortiumInstallment.toNumber(),
      operationCost: consortiumOperationCost.toNumber(),
    },
    financing: {
      financedAmount,
      totalPaid: financingTotalPaid.toNumber(),
      firstInstallment: financingSchedule[0]?.payment ?? 0,
      operationCost: financingOperationCost.toNumber(),
      downPaymentOpportunityCost: downPaymentOpportunityCost.toNumber(),
      totalCostWithOpportunity: totalCostWithOpportunity.toNumber(),
    },
    winner,
    differenceInFavorOfWinner: differenceInFavorOfWinner.toNumber(),
    invalidTerm: false,
  };
}
