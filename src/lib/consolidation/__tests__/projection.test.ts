import { describe, expect, it } from "vitest";
import { computeYearByYearProjection } from "../projection";
import { computeAccumulation } from "@/lib/planning/accumulation";

const input = {
  currentAge: 30,
  retirementAge: 50,
  lifeExpectancyAge: 80,
  currentPatrimony: 50000,
  monthlyContributionAccumulation: 2000,
  accumulationAnnualRate: 0.12,
  inflationAnnualRate: 0.045,
  usufructAnnualRate: 0.04,
  desiredPassiveIncome: 8000,
  otherPassiveIncome: 0,
};

describe("computeYearByYearProjection", () => {
  it("real interest closes with the real balance (Investido + Juros = Patrimônio real)", () => {
    const years = computeYearByYearProjection(input).filter((y) => y.phase === "ACCUMULATION");
    for (const y of years) {
      expect((y.totalInvested ?? 0) + (y.cumulativeInterestReal ?? 0)).toBeCloseTo(y.balanceReal, 4);
      expect((y.totalInvested ?? 0) + (y.cumulativeInterest ?? 0)).toBeCloseTo(y.balanceNominal ?? 0, 4);
    }
  });

  it("last accumulation row matches the 'Os juros põem' bar (totalReturnReal)", () => {
    const years = computeYearByYearProjection(input).filter((y) => y.phase === "ACCUMULATION");
    const last = years[years.length - 1];
    const acc = computeAccumulation(input);
    expect(last.cumulativeInterestReal).toBeCloseTo(acc.totalReturnReal, 4);
  });

  it("drawdown rows carry no interest figures", () => {
    const drawdown = computeYearByYearProjection(input).filter((y) => y.phase === "DRAWDOWN");
    expect(drawdown.length).toBe(30);
    for (const y of drawdown) expect(y.cumulativeInterestReal).toBeNull();
  });
});
