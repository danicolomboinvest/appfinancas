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

  it("approximateSensitivity (-duration * Δtaxa) grows with more years remaining until maturity", () => {
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
});
