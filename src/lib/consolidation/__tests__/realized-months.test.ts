import { describe, expect, it } from "vitest";
import { monthsElapsedInYear } from "../realized-months";

describe("monthsElapsedInYear", () => {
  it("returns 12 for a past year", () => {
    const today = new Date(2026, 2, 15); // 15/mar/2026
    expect(monthsElapsedInYear(2025, today)).toBe(12);
  });

  it("returns 0 for a future year", () => {
    const today = new Date(2026, 2, 15);
    expect(monthsElapsedInYear(2027, today)).toBe(0);
  });

  it("returns the current month number for the current year", () => {
    const today = new Date(2026, 2, 15); // março (index 2) -> mês 3
    expect(monthsElapsedInYear(2026, today)).toBe(3);
  });

  it("returns 1 in january and 12 in december of the current year", () => {
    expect(monthsElapsedInYear(2026, new Date(2026, 0, 1))).toBe(1);
    expect(monthsElapsedInYear(2026, new Date(2026, 11, 31))).toBe(12);
  });
});
