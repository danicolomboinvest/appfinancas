import { describe, expect, it } from "vitest";
import { planContribution } from "../contribution-plan";

describe("planContribution", () => {
  it("sends the whole contribution to what is furthest below target, never selling", () => {
    // 10.000 na carteira: 8.000 em renda fixa (alvo 50%), 2.000 em ações (alvo 50%).
    const plan = planContribution(
      [
        { assetClass: "RENDA_FIXA_POS_FIXADA", currentValue: 8000, targetPercent: 0.5 },
        { assetClass: "ACOES_BRASIL", currentValue: 2000, targetPercent: 0.5 },
      ],
      1000,
    );
    expect(plan).toEqual([{ assetClass: "ACOES_BRASIL", amount: 1000 }]);
  });

  it("splits by how much each class is missing, rounded to tens, summing exactly the contribution", () => {
    const plan = planContribution(
      [
        { assetClass: "RENDA_FIXA_POS_FIXADA", currentValue: 2050, targetPercent: 0.5 },
        { assetClass: "ACOES_BRASIL", currentValue: 3687, targetPercent: 0.3 },
        { assetClass: "FIIS", currentValue: 0, targetPercent: 0.2 },
      ],
      500,
    );
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(500);
    expect(plan.map((p) => p.assetClass)).toEqual(["FIIS", "RENDA_FIXA_POS_FIXADA"]);
    expect(plan.find((p) => p.assetClass === "ACOES_BRASIL")).toBeUndefined();
  });

  it("follows the targets when the portfolio is already balanced, and returns nothing for zero", () => {
    const balanced = planContribution(
      [
        { assetClass: "RENDA_FIXA_POS_FIXADA", currentValue: 600, targetPercent: 0.6 },
        { assetClass: "ACOES_BRASIL", currentValue: 400, targetPercent: 0.4 },
      ],
      100,
    );
    expect(balanced).toEqual([
      { assetClass: "RENDA_FIXA_POS_FIXADA", amount: 60 },
      { assetClass: "ACOES_BRASIL", amount: 40 },
    ]);
    expect(planContribution([{ assetClass: "ACOES_BRASIL", currentValue: 0, targetPercent: 1 }], 0)).toEqual([]);
  });
});
