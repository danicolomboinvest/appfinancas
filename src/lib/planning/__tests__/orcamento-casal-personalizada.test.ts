import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

vi.mock("@/lib/repositories/budget.repo", () => ({
  listBudgetsForYear: async () => [{ month: 10, parentCategory: null, customCategoryId: "pet-da-titular", plannedAmount: 200 }],
  sumExpensesByParentCategoryForYear: async () => [{ month: 10, parentCategory: "MORADIA", spent: 5000 }],
  sumExpensesByCustomCategoryForYear: async () => [{ month: 10, customCategoryId: "pet-do-par", spent: 300 }],
  getFirstEntryMonth: async () => 1,
}));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: async () => [] }));

import { getAnnualPlannedVsActual } from "../budget-comparison";

describe("Orçamento do casal com categoria personalizada de cada um", () => {
  it("o gasto do par na categoria dele e o plano da titular na dela entram no total", async () => {
    const r = await getAnnualPlannedVsActual({ userId: "par", profileId: "p" } as AuthContext, 2026);
    const out = r.months.find((m) => m.month === 10)!;
    expect(out.totalSpent).toBe(5300);
    expect(out.totalPlanned).toBe(200);
  });
});
