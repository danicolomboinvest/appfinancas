import { describe, expect, it } from "vitest";
import { detectRecurring, installmentDescription, parseInstallment, type RecurrenceEntry } from "../recurrence";

const e = (year: number, month: number, day: number, patch: Partial<RecurrenceEntry> = {}): RecurrenceEntry => ({
  year,
  month,
  category: "EXPENSE",
  parentCategory: "MORADIA",
  customCategoryId: null,
  subcategory: "Aluguel",
  description: "Aluguel",
  amount: 1500,
  entryDate: new Date(year, month - 1, day),
  ...patch,
});

describe("detectRecurring", () => {
  it("suggests what showed up in two of the last three months and is missing now", () => {
    const previous = [e(2026, 6, 5), e(2026, 7, 5), e(2026, 8, 6), e(2026, 8, 12, { subcategory: "Restaurante", description: "Outback", amount: 180 })];
    const found = detectRecurring(previous, []);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ description: "Aluguel", amount: 1500, typicalDay: 5, seenInMonths: 3 });
  });

  it("stays quiet when the entry is already in the current month, and ignores tiny amount drift", () => {
    const previous = [e(2026, 7, 5), e(2026, 8, 5, { amount: 1500.4 })];
    expect(detectRecurring(previous, [e(2026, 9, 5)])).toEqual([]);
    expect(detectRecurring(previous, [])).toHaveLength(1);
  });
});

describe("parseInstallment", () => {
  it("reads card installments in the common formats", () => {
    expect(parseInstallment("MAGAZINE LUIZA 03/10")).toEqual({ current: 3, total: 10 });
    expect(parseInstallment("Parcela 2 de 6 - Notebook")).toEqual({ current: 2, total: 6 });
    expect(parseInstallment("IFOOD")).toBeNull();
    expect(parseInstallment("PIX 11/09")).toBeNull();
  });

  it("rewrites the installment number for the next months", () => {
    expect(installmentDescription("MAGAZINE LUIZA 03/10", 4, 10)).toBe("MAGAZINE LUIZA 04/10");
    expect(installmentDescription("Parcela 2 de 6 - Notebook", 3, 6)).toBe("Parcela 03 de 6 - Notebook");
  });
});
