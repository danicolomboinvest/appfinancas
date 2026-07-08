import { describe, expect, it } from "vitest";
import { simulateMarkToMarket } from "../mark-to-market";

describe("simulateMarkToMarket", () => {
  it("shows a profit when market rates fall below the contracted rate", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.08,
      totalYears: 5,
      yearsRemaining: 3,
    });
    expect(result.profitOrLoss).toBeGreaterThan(0);
  });

  it("shows a loss when market rates rise above the contracted rate", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.14,
      totalYears: 5,
      yearsRemaining: 3,
    });
    expect(result.profitOrLoss).toBeLessThan(0);
  });

  it("shows no price effect when the rate does not change", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.1,
      totalYears: 5,
      yearsRemaining: 3,
    });
    expect(result.profitOrLoss).toBeCloseTo(0, 6);
  });

  it("approximateSensitivity (variação percentual do preço) grows with more years remaining until maturity", () => {
    // Quanto maior a duration (anos restantes até o vencimento), maior o tombo se a taxa subir.
    const nearMaturity = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 0.5,
    });
    const farFromMaturity = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 9,
    });

    expect(Math.abs(farFromMaturity.approximateSensitivity)).toBeGreaterThan(
      Math.abs(nearMaturity.approximateSensitivity),
    );
  });

  it("only includes duration scenarios up to totalYears", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.1,
      totalYears: 2,
      yearsRemaining: 1,
    });
    for (const row of result.sensitivityMatrix) {
      expect(row.durationYears).toBeLessThanOrEqual(2);
    }
  });

  it("approximateSensitivity equals (marketPrice - carryingPrice) / carryingPrice", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 6,
    });
    const expected = (result.marketPrice - result.carryingPrice) / result.carryingPrice;
    expect(result.approximateSensitivity).toBeCloseTo(expected, 10);
  });

  it("never produces a price deviation below -100% (compound pricing can't go negative), even for long durations and large rate hikes", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.13,
      totalYears: 17,
      yearsRemaining: 10,
    });
    for (const row of result.sensitivityMatrix) {
      for (const cell of row.cells) {
        expect(cell.priceDeviation).toBeGreaterThan(-1);
      }
    }
  });

  it("uses duration instead of yearsRemaining to price the bond when hasSemiannualCoupons is true", () => {
    const withDuration = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 6,
      hasSemiannualCoupons: true,
      duration: 4,
    });
    const equivalentZeroCoupon = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 4,
    });
    expect(withDuration.carryingPrice).toBeCloseTo(equivalentZeroCoupon.carryingPrice, 8);
    expect(withDuration.marketPrice).toBeCloseTo(equivalentZeroCoupon.marketPrice, 8);
  });

  it("zero-coupon path (hasSemiannualCoupons omitted or false) is unaffected by an unused duration value — regression", () => {
    const base = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 6,
    });
    const withUnusedDuration = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.12,
      totalYears: 10,
      yearsRemaining: 6,
      hasSemiannualCoupons: false,
      duration: 2,
    });
    expect(withUnusedDuration.carryingPrice).toBeCloseTo(base.carryingPrice, 10);
    expect(withUnusedDuration.marketPrice).toBeCloseTo(base.marketPrice, 10);
    expect(withUnusedDuration.scaledMarketValue).toBeUndefined();
    expect(withUnusedDuration.scaledProfitOrLoss).toBeUndefined();
  });

  it("scales marketPrice and profitOrLoss proportionally when investedAmount is informed", () => {
    const result = simulateMarkToMarket({
      faceValue: 1000,
      originalRate: 0.1,
      newRate: 0.08,
      totalYears: 5,
      yearsRemaining: 3,
      investedAmount: 2000,
    });
    const scaleFactor = 2000 / result.carryingPrice;
    expect(result.scaledMarketValue).toBeCloseTo(result.marketPrice * scaleFactor, 8);
    expect(result.scaledProfitOrLoss).toBeCloseTo(result.profitOrLoss * scaleFactor, 8);
  });
});
