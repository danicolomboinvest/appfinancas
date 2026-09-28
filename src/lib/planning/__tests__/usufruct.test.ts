import { describe, expect, it } from "vitest";
import { computeUsufruct, usufructRateAboveAccumulation } from "../usufruct";
import { nominalToReal } from "@/lib/finance/rate-conversion";

describe("computeUsufruct", () => {
  // A taxa é ACIMA da inflação: patrimônio e gasto desejado estão em dinheiro de hoje.
  it("applies the above-inflation rate to the patrimony in today's money", () => {
    const result = computeUsufruct({
      finalValueReal: 1_200_000,
      usufructAnnualRate: 0.04,
      otherPassiveIncome: 500,
      desiredPassiveIncome: 5000,
    });

    expect(result.monthlyPassiveIncomeFromPortfolio).toBeCloseTo(4000, 6);
    expect(result.totalPassiveIncome).toBeCloseTo(4500, 6);
    expect(result.surplusOrDeficit).toBeCloseTo(-500, 6);
  });
});

describe("usufructRateAboveAccumulation", () => {
  // Padrões do app: 10% ao ano com 4,5% de inflação dá ~5,26% acima da inflação.
  const realAcumulo = nominalToReal(0.1, 0.045).toNumber();

  it("flags a retirement rate above the accumulation's real rate", () => {
    expect(usufructRateAboveAccumulation(0.06, realAcumulo)).toBe(true);
  });

  it("accepts a more conservative retirement rate", () => {
    expect(usufructRateAboveAccumulation(0.04, realAcumulo)).toBe(false);
    expect(usufructRateAboveAccumulation(realAcumulo, realAcumulo)).toBe(false);
  });
});
