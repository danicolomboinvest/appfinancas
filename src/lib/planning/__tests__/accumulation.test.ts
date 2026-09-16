import { describe, expect, it } from "vitest";
import { computeAccumulation } from "../accumulation";

/** O caso real que estava na tela da Dani quando o erro apareceu. */
const CASO = {
  currentAge: 25,
  retirementAge: 63,
  currentPatrimony: 50_000,
  monthlyContributionAccumulation: 1_000,
  accumulationAnnualRate: 0.12,
  inflationAnnualRate: 0.045,
};

describe("computeAccumulation", () => {
  it("keeps the nominal and the real scenario separate", () => {
    const r = computeAccumulation(CASO);
    expect(r.years).toBe(38);
    expect(r.realAnnualRate).toBeCloseTo(0.0718, 4);
    expect(r.finalValueNominal).toBeCloseTo(11_421_203.75, 0);
    expect(r.finalValueReal).toBeCloseTo(2_928_012.09, 0);
  });

  /**
   * A regressão que motivou `totalReturnReal`: a tela somava o que saiu do bolso com os juros
   * NOMINAIS e apresentava o total ao lado do valor final REAL. As duas contas não fecham
   * entre si, e a diferença passa de um milhão.
   */
  it("gives interest that closes with its own final value, in each scenario", () => {
    const r = computeAccumulation(CASO);
    expect(r.totalInvested + r.totalReturn).toBeCloseTo(r.finalValueNominal, 6);
    expect(r.totalInvested + r.totalReturnReal).toBeCloseTo(r.finalValueReal, 6);
  });

  it("does not let the real value be mistaken for the nominal one discounted", () => {
    const r = computeAccumulation(CASO);
    const nominalDescontado = r.finalValueNominal / (1 + CASO.inflationAnnualRate) ** r.years;
    // ~R$ 2,14 mi contra ~R$ 2,93 mi: cenários diferentes, não arredondamento.
    expect(nominalDescontado).toBeLessThan(r.finalValueReal * 0.8);
  });

  it("has nothing to accumulate once the target age is reached", () => {
    const r = computeAccumulation({ ...CASO, currentAge: 63 });
    expect(r.years).toBe(0);
    expect(r.finalValueReal).toBeCloseTo(CASO.currentPatrimony, 6);
    expect(r.totalReturnReal).toBeCloseTo(0, 6);
  });
});
