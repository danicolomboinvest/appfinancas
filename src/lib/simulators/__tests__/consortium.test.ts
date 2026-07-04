import { describe, expect, it } from "vitest";
import { simulateConsortiumVsFinancing } from "../consortium";

const baseInput = {
  creditValue: 100000,
  consortiumAdminFeeRate: 0.18,
  consortiumTermMonths: 120,
  financingDownPayment: 20000,
  financingCetAnnualRate: 0.12,
  financingTermMonths: 120,
  financingSystem: "PRICE" as const,
  opportunityCostAnnualRate: 0.11,
};

describe("simulateConsortiumVsFinancing", () => {
  it("computes consortium operation cost as exactly the admin fee", () => {
    const result = simulateConsortiumVsFinancing(baseInput);
    expect(result.consortium.operationCost).toBeCloseTo(100000 * 0.18, 6);
    expect(result.consortium.totalPaid).toBeCloseTo(118000, 6);
    expect(result.consortium.installment).toBeCloseTo(118000 / 120, 6);
  });

  it("increases financing's total cost with opportunity as opportunityCostAnnualRate rises", () => {
    const low = simulateConsortiumVsFinancing({ ...baseInput, opportunityCostAnnualRate: 0.02 });
    const high = simulateConsortiumVsFinancing({ ...baseInput, opportunityCostAnnualRate: 0.2 });
    expect(high.financing.downPaymentOpportunityCost).toBeGreaterThan(low.financing.downPaymentOpportunityCost);
    expect(high.financing.totalCostWithOpportunity).toBeGreaterThan(low.financing.totalCostWithOpportunity);
  });

  it("picks the option with the lower total cost", () => {
    const result = simulateConsortiumVsFinancing(baseInput);
    const consortiumCost = result.consortium.operationCost;
    const financingCost = result.financing.totalCostWithOpportunity;
    expect(result.winner).toBe(consortiumCost <= financingCost ? "CONSORCIO" : "FINANCIAMENTO");
  });
});
