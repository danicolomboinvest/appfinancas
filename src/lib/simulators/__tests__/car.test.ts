import { describe, expect, it } from "vitest";
import { simulateCarComparison } from "../car";

const baseInput = {
  carPrice: 100000,
  priceAfter1Year: 85000,
  priceAfter2Years: 75000,
  monthlyFuelCost: 400,
  subscriptionMonthlyFee: 2500,
  annualFixedCosts: 4000,
  opportunityCostMonthlyRate: 0.008,
};

describe("simulateCarComparison", () => {
  it("computes depreciation rates from the price points", () => {
    const result = simulateCarComparison(baseInput);
    expect(result.depreciationRateAfter1Year).toBeCloseTo(0.15, 6);
    expect(result.depreciationRateAfter2Years).toBeCloseTo(0.25, 6);
  });

  it("computes subscription cash cost as (fee + fuel) * 24", () => {
    const result = simulateCarComparison(baseInput);
    expect(result.subscriptionCashCost).toBeCloseTo((2500 + 400) * 24, 6);
  });

  it("computes purchase opportunity cost as carPrice * monthlyRate * 24", () => {
    const result = simulateCarComparison(baseInput);
    expect(result.opportunityCost).toBeCloseTo(100000 * 0.008 * 24, 6);
  });

  it("picks the option with the lower net result", () => {
    const result = simulateCarComparison(baseInput);
    expect(result.winner).toBe(
      result.netResultSubscription <= result.netResultPurchase ? "ASSINATURA" : "COMPRA",
    );
  });

  it("a cheaper subscription fee makes ASSINATURA relatively more attractive", () => {
    const expensive = simulateCarComparison({ ...baseInput, subscriptionMonthlyFee: 3000 });
    const cheap = simulateCarComparison({ ...baseInput, subscriptionMonthlyFee: 500 });
    expect(cheap.netResultSubscription).toBeLessThan(expensive.netResultSubscription);
  });
});
