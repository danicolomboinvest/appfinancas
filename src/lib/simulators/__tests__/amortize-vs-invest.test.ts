import { describe, expect, it } from "vitest";
import { simulateAmortizeVsInvest } from "../amortize-vs-invest";

describe("simulateAmortizeVsInvest", () => {
  it("finishes the loan earlier when extra amount is applied (SAC)", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.11,
      remainingMonths: 240,
      system: "SAC",
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.scheduleWithExtra.length).toBeLessThan(result.scheduleWithoutExtra.length);
    expect(result.interestSavings).toBeGreaterThan(0);
  });

  it("finishes the loan earlier when extra amount is applied (PRICE)", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.11,
      remainingMonths: 240,
      system: "PRICE",
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.scheduleWithExtra.length).toBeLessThan(result.scheduleWithoutExtra.length);
    expect(result.interestSavings).toBeGreaterThan(0);
  });

  it("applies the income tax rate to the investment scenario (net < gross return)", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.11,
      remainingMonths: 120,
      system: "SAC",
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.netInvestmentAnnualRate).toBeCloseTo(0.12 * 0.85, 10);
    expect(result.netInvestmentAnnualRate).toBeLessThan(0.12);
  });

  it("picks INVESTIR when the investment return dwarfs the loan's interest rate", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.03,
      remainingMonths: 60,
      system: "SAC",
      extraAmount: 20000,
      investmentAnnualRate: 0.3,
      incomeTaxRate: 0.15,
    });

    expect(result.winner).toBe("INVESTIR");
  });

  it("picks AMORTIZAR when the loan rate dwarfs the investment return", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.3,
      remainingMonths: 60,
      system: "SAC",
      extraAmount: 20000,
      investmentAnnualRate: 0.03,
      incomeTaxRate: 0.15,
    });

    expect(result.winner).toBe("AMORTIZAR");
  });

  // Os padrões da tela: CET de 11% contra 12% bruto com 15% de IR (10,2% líquido). A dívida
  // custa mais do que o investimento rende, então amortizar tem que vencer. Antes, a soma
  // nominal dos juros economizados (~40 mil) era comparada com o ganho composto (~120 mil).
  it.each(["SAC", "PRICE"] as const)("picks AMORTIZAR with the screen defaults when CET beats the net return (%s)", (system) => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.11,
      remainingMonths: 240,
      system,
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.winner).toBe("AMORTIZAR");
    // Mesma régua: o ganho de amortizar inclui o que as parcelas liberadas rendem.
    expect(result.amortizeGain).toBeGreaterThan(result.interestSavings);
    expect(result.amortizeGain).toBeGreaterThan(result.investmentGain);
    expect(result.differenceInFavorOfWinner).toBeCloseTo(result.amortizeGain - result.investmentGain, 6);
  });

  it("picks INVESTIR when the net return beats the CET, even with long terms", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.08,
      remainingMonths: 240,
      system: "SAC",
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.winner).toBe("INVESTIR");
  });

  it("ties when the CET equals the net return: same money, same rate", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 200000,
      cetAnnualRate: 0.102,
      remainingMonths: 240,
      system: "PRICE",
      extraAmount: 20000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.amortizeGain).toBeCloseTo(result.investmentGain, 0);
  });

  it("keeps investing the part of the extra that exceeds the outstanding balance", () => {
    const result = simulateAmortizeVsInvest({
      outstandingBalance: 10000,
      cetAnnualRate: 0.102,
      remainingMonths: 60,
      system: "SAC",
      extraAmount: 30000,
      investmentAnnualRate: 0.12,
      incomeTaxRate: 0.15,
    });

    expect(result.scheduleWithExtra).toHaveLength(0);
    expect(result.amortizeGain).toBeCloseTo(result.investmentGain, 0);
  });
});
