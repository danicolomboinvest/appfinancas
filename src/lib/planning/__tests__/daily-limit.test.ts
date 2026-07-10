import { describe, expect, it } from "vitest";
import { computeDailySpendingLimit, computeDaysRemainingInMonth } from "../daily-limit";

describe("computeDaysRemainingInMonth", () => {
  it("counts today as one of the remaining days", () => {
    expect(computeDaysRemainingInMonth(new Date(2026, 6, 10))).toBe(22); // julho tem 31 dias
  });

  it("returns 1 on the last day of the month", () => {
    expect(computeDaysRemainingInMonth(new Date(2026, 6, 31))).toBe(1);
  });

  it("handles february correctly", () => {
    expect(computeDaysRemainingInMonth(new Date(2026, 1, 1))).toBe(28);
  });
});

describe("computeDailySpendingLimit", () => {
  it("divides what's left by the days remaining", () => {
    expect(computeDailySpendingLimit(3000, 1000, 20)).toBe(100);
  });

  it("returns null when there is no plan set", () => {
    expect(computeDailySpendingLimit(0, 500, 20)).toBeNull();
  });

  it("returns null when there are no days left", () => {
    expect(computeDailySpendingLimit(3000, 1000, 0)).toBeNull();
  });

  it("goes negative when already over budget, letting the caller decide how to show it", () => {
    expect(computeDailySpendingLimit(1000, 1500, 10)).toBe(-50);
  });
});
