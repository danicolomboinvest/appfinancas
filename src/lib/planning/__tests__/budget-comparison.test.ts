import { describe, expect, it } from "vitest";
import {
  compareCategoryBudget,
  buildMonthlyComparison,
  computeMonthSavings,
  findBiggestOverrun,
  findBiggestSaving,
  computeOverBudgetStreak,
  type CategoryComparison,
  type MonthlyPlannedVsActual,
} from "../budget-comparison";

describe("compareCategoryBudget", () => {
  it("returns SEM_PLANO when there is no plan", () => {
    expect(compareCategoryBudget(0, 100)).toEqual({ deviationPercent: null, status: "SEM_PLANO" });
  });

  it("returns ACIMA with a positive deviation when spending exceeds the plan", () => {
    const result = compareCategoryBudget(100, 150);
    expect(result.status).toBe("ACIMA");
    expect(result.deviationPercent).toBeCloseTo(0.5);
  });

  it("returns DENTRO with a negative deviation when spending is below the plan", () => {
    const result = compareCategoryBudget(100, 80);
    expect(result.status).toBe("DENTRO");
    expect(result.deviationPercent).toBeCloseTo(-0.2);
  });

  it("returns DENTRO when spending exactly matches the plan", () => {
    const result = compareCategoryBudget(100, 100);
    expect(result.status).toBe("DENTRO");
    expect(result.deviationPercent).toBe(0);
  });
});

describe("buildMonthlyComparison", () => {
  it("fills in every parent category, even ones with no budget or spending", () => {
    const comparison = buildMonthlyComparison(3, true, [], []);
    expect(comparison.categories).toHaveLength(7);
    expect(comparison.categories.every((c) => c.status === "SEM_PLANO")).toBe(true);
    expect(comparison.totalPlanned).toBe(0);
    expect(comparison.totalSpent).toBe(0);
  });

  it("sums totals across categories", () => {
    const comparison = buildMonthlyComparison(
      3,
      true,
      [
        { parentCategory: "ALIMENTACAO", plannedAmount: 800 },
        { parentCategory: "TRANSPORTE", plannedAmount: 400 },
      ],
      [
        { parentCategory: "ALIMENTACAO", spent: 720 },
        { parentCategory: "TRANSPORTE", spent: 530 },
      ],
    );
    expect(comparison.totalPlanned).toBe(1200);
    expect(comparison.totalSpent).toBe(1250);
    const transporte = comparison.categories.find((c) => c.parentCategory === "TRANSPORTE")!;
    expect(transporte.status).toBe("ACIMA");
  });
});

describe("computeMonthSavings", () => {
  it("is positive when spending less than planned", () => {
    const comparison = buildMonthlyComparison(1, true, [{ parentCategory: "LAZER", plannedAmount: 500 }], [
      { parentCategory: "LAZER", spent: 300 },
    ]);
    expect(computeMonthSavings(comparison)).toBe(200);
  });
});

describe("findBiggestOverrun / findBiggestSaving", () => {
  const categories: CategoryComparison[] = [
    { parentCategory: "MORADIA", planned: 1000, spent: 1000, deviationPercent: 0, status: "DENTRO" },
    { parentCategory: "ALIMENTACAO", planned: 800, spent: 720, deviationPercent: -0.1, status: "DENTRO" },
    { parentCategory: "TRANSPORTE", planned: 400, spent: 530, deviationPercent: 0.325, status: "ACIMA" },
    { parentCategory: "LAZER", planned: 300, spent: 450, deviationPercent: 0.5, status: "ACIMA" },
    { parentCategory: "SAUDE", planned: 0, spent: 100, deviationPercent: null, status: "SEM_PLANO" },
  ];

  it("finds the category with the largest positive overrun", () => {
    expect(findBiggestOverrun(categories)?.parentCategory).toBe("LAZER");
  });

  it("finds the category with the largest saving", () => {
    expect(findBiggestSaving(categories)?.parentCategory).toBe("ALIMENTACAO");
  });

  it("returns null when there are no overruns", () => {
    expect(findBiggestOverrun(categories.filter((c) => c.status !== "ACIMA"))).toBeNull();
  });

  it("returns null when there are no savings", () => {
    expect(findBiggestSaving(categories.filter((c) => c.parentCategory !== "ALIMENTACAO"))).toBeNull();
  });
});

describe("computeOverBudgetStreak", () => {
  function makeMonth(month: number, status: CategoryComparison["status"]): MonthlyPlannedVsActual {
    return {
      month,
      isRealized: true,
      totalPlanned: 300,
      totalSpent: status === "ACIMA" ? 400 : 200,
      categories: [{ parentCategory: "LAZER", planned: 300, spent: status === "ACIMA" ? 400 : 200, deviationPercent: null, status }],
    };
  }

  it("counts consecutive over-budget months from the most recent backwards", () => {
    const monthsDescending = [makeMonth(5, "ACIMA"), makeMonth(4, "ACIMA"), makeMonth(3, "ACIMA"), makeMonth(2, "DENTRO")];
    expect(computeOverBudgetStreak(monthsDescending, "LAZER")).toBe(3);
  });

  it("stops counting at the first month within budget, ignoring older months", () => {
    const monthsDescending = [makeMonth(5, "DENTRO"), makeMonth(4, "ACIMA"), makeMonth(3, "ACIMA")];
    expect(computeOverBudgetStreak(monthsDescending, "LAZER")).toBe(0);
  });

  it("returns 0 when the most recent month is not over budget", () => {
    expect(computeOverBudgetStreak([makeMonth(5, "DENTRO")], "LAZER")).toBe(0);
  });
});
