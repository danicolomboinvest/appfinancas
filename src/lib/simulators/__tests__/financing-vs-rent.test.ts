import { describe, expect, it } from "vitest";
import { simulateFinancingVsRent, type FinancingVsRentInput } from "../financing-vs-rent";

// Os padrões da tela do Financiar vs. Alugar.
const base: FinancingVsRentInput = {
  propertyValue: 500000,
  downPayment: 100000,
  cetAnnualRate: 0.11,
  propertyAppreciationAnnualRate: 0.05,
  termMonths: 360,
  system: "SAC",
  monthlyRent: 2200,
  rentAnnualAdjustment: 0.05,
  investmentAnnualRate: 0.11,
  incomeTaxRate: 0.15,
};

describe("simulateFinancingVsRent", () => {
  it("applies the income tax to the renter's investment (net < gross)", () => {
    const result = simulateFinancingVsRent(base);
    expect(result.netInvestmentAnnualRate).toBeCloseTo(0.11 * 0.85, 10);
  });

  // Com a taxa bruta, o aluguel "vencia" nos padrões; com 15% de IR, financiar sai na frente.
  it.each(["SAC", "PRICE"] as const)("picks FINANCIAR with the screen defaults once IR is applied (%s)", (system) => {
    const comIr = simulateFinancingVsRent({ ...base, system });
    const semIr = simulateFinancingVsRent({ ...base, system, incomeTaxRate: 0 });

    expect(comIr.winner).toBe("FINANCIAR");
    expect(comIr.finalInvestedPatrimony).toBeLessThan(semIr.finalInvestedPatrimony);
    expect(comIr.finalFinancingPatrimony).toBeCloseTo(semIr.finalFinancingPatrimony, 6);
  });

  // Apagar o prazo para redigitar gravava 0 e a tela caía lendo o último mês de uma lista vazia.
  it.each([0, -1, 0.5, Number.NaN])("does not crash when the term is %s", (termMonths) => {
    for (const system of ["SAC", "PRICE"] as const) {
      const result = simulateFinancingVsRent({ ...base, system, termMonths });
      expect(result.invalidTerm).toBe(true);
      expect(result.schedule).toHaveLength(0);
    }
  });

  it("uses whole months when the term is fractional", () => {
    const result = simulateFinancingVsRent({ ...base, termMonths: 12.5 });
    expect(result.invalidTerm).toBe(false);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule[11].outstandingBalance).toBeCloseTo(0, 6);
  });
});
