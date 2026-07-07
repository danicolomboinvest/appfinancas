import { describe, expect, it } from "vitest";
import { buildMonthlyBreakdowns } from "../yearly";

describe("buildMonthlyBreakdowns", () => {
  it("marks months up to monthsElapsed as realized and the rest as not realized", () => {
    const months = buildMonthlyBreakdowns([], 3);
    expect(months).toHaveLength(12);
    expect(months.filter((m) => m.isRealized).map((m) => m.month)).toEqual([1, 2, 3]);
    expect(months.filter((m) => !m.isRealized).map((m) => m.month)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("keeps a future month's own values intact (they still exist, just not realized)", () => {
    const months = buildMonthlyBreakdowns(
      [{ month: 6, category: "EXPENSE", sum: 150 }], // despesa recorrente projetada em junho
      3, // só até março já ocorreu
    );
    const june = months.find((m) => m.month === 6)!;
    expect(june.totalExpense).toBe(150);
    expect(june.isRealized).toBe(false);
  });

  it("marks all 12 months as realized when monthsElapsed is 12 (past year)", () => {
    const months = buildMonthlyBreakdowns([], 12);
    expect(months.every((m) => m.isRealized)).toBe(true);
  });

  it("marks no months as realized when monthsElapsed is 0 (future year)", () => {
    const months = buildMonthlyBreakdowns([], 0);
    expect(months.every((m) => !m.isRealized)).toBe(true);
  });

  it("aggregates income/expense/investment correctly per month", () => {
    const months = buildMonthlyBreakdowns(
      [
        { month: 1, category: "INCOME", sum: 5000 },
        { month: 1, category: "EXPENSE", sum: 2000 },
        { month: 1, category: "INVESTMENT_CONTRIBUTION", sum: 1000 },
      ],
      12,
    );
    const jan = months.find((m) => m.month === 1)!;
    expect(jan.totalIncome).toBe(5000);
    expect(jan.totalExpense).toBe(2000);
    expect(jan.totalInvestment).toBe(1000);
    expect(jan.balance).toBe(2000); // 5000 - 2000 - 1000
  });
});
