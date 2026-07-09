import { describe, expect, it } from "vitest";
import { simulateWorthIt, WORTH_IT_ANNUAL_RATE } from "../worth-it";

describe("simulateWorthIt", () => {
  it("computes hours equivalent from price and hourly rate (income / 220h)", () => {
    const result = simulateWorthIt({ price: 90, monthlyIncome: 3500, mode: "SINGLE", horizonYears: 5 });
    const hourlyRate = 3500 / 220;
    expect(result.hourlyRate).toBeCloseTo(hourlyRate, 6);
    expect(result.hoursEquivalent).toBeCloseTo(90 / hourlyRate, 6);
  });

  it("returns null hoursEquivalent when there is no registered income", () => {
    const result = simulateWorthIt({ price: 90, monthlyIncome: 0, mode: "SINGLE", horizonYears: 5 });
    expect(result.hoursEquivalent).toBeNull();
  });

  it("SINGLE mode compounds the price as a lump sum at the annual rate", () => {
    const result = simulateWorthIt({ price: 1000, monthlyIncome: 3500, mode: "SINGLE", horizonYears: 1 });
    expect(result.futureValueIfInvested).toBeCloseTo(1000 * (1 + WORTH_IT_ANNUAL_RATE), 4);
    expect(result.totalInvested).toBe(1000);
    expect(result.difference).toBeCloseTo(result.futureValueIfInvested - 1000, 4);
  });

  it("RECURRING mode treats the price as a monthly contribution over the horizon", () => {
    const result = simulateWorthIt({ price: 100, monthlyIncome: 3500, mode: "RECURRING", horizonYears: 1 });
    expect(result.totalInvested).toBe(100 * 12);
    expect(result.futureValueIfInvested).toBeGreaterThan(result.totalInvested);
  });

  it("a longer horizon yields a larger future value for the same price", () => {
    const short = simulateWorthIt({ price: 500, monthlyIncome: 3500, mode: "SINGLE", horizonYears: 1 });
    const long = simulateWorthIt({ price: 500, monthlyIncome: 3500, mode: "SINGLE", horizonYears: 10 });
    expect(long.futureValueIfInvested).toBeGreaterThan(short.futureValueIfInvested);
  });
});
