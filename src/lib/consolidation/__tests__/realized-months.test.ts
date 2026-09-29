import { describe, expect, it } from "vitest";
import { mesesDaComparacao, monthsElapsedInYear } from "../realized-months";

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

describe("mesesDaComparacao", () => {
  it("no ano corrente compara o último mês fechado com o anterior, nunca o mês pela metade", () => {
    expect(mesesDaComparacao(2026, new Date(2026, 8, 2))).toEqual({ atual: { year: 2026, month: 8 }, anterior: { year: 2026, month: 7 } });
  });

  it("em fevereiro compara janeiro com o dezembro do ano anterior", () => {
    expect(mesesDaComparacao(2026, new Date(2026, 1, 10))).toEqual({ atual: { year: 2026, month: 1 }, anterior: { year: 2025, month: 12 } });
  });

  it("em janeiro ainda não há mês fechado no ano", () => {
    expect(mesesDaComparacao(2026, new Date(2026, 0, 20))).toBeNull();
  });

  it("ano passado: dezembro contra novembro; ano futuro: nada", () => {
    expect(mesesDaComparacao(2025, new Date(2026, 8, 2))).toEqual({ atual: { year: 2025, month: 12 }, anterior: { year: 2025, month: 11 } });
    expect(mesesDaComparacao(2027, new Date(2026, 8, 2))).toBeNull();
  });
});
