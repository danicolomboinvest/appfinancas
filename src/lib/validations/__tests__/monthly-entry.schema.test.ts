import { describe, expect, it } from "vitest";
import { monthlyEntrySchema } from "../monthly-entry.schema";

function form(overrides: Partial<Record<string, string>> = {}) {
  return {
    year: "2026",
    month: "9",
    category: "EXPENSE",
    parentCategory: "ALIMENTACAO",
    amount: "100",
    currency: undefined,
    exchangeRate: undefined,
    repeatMonthly: undefined,
    ...overrides,
  };
}

describe("monthlyEntrySchema: o mês da consolidação segue a entryDate escolhida", () => {
  it("lançamento aberto em setembro, mas com data de outubro, consolida em outubro", () => {
    const r = monthlyEntrySchema.safeParse(form({ entryDate: "2026-10-15" }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.year).toBe(2026);
    expect(r.data.month).toBe(10);
    expect(r.data.entryDate?.getDate()).toBe(15);
  });

  it("sem entryDate, mantém o year/month da página onde o formulário abriu", () => {
    const r = monthlyEntrySchema.safeParse(form());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.year).toBe(2026);
    expect(r.data.month).toBe(9);
  });

  it("data de dezembro virando janeiro do ano seguinte também troca o ano", () => {
    const r = monthlyEntrySchema.safeParse(form({ year: "2026", month: "12", entryDate: "2027-01-05" }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.year).toBe(2027);
    expect(r.data.month).toBe(1);
  });
});
