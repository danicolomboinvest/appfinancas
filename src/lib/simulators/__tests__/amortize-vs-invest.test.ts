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
});
