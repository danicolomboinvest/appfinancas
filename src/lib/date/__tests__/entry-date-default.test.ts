import { describe, it, expect } from "vitest";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";
import { defaultEntryDateValue, toDateInputValue } from "../entry-date-default";

/** Meio-dia local, como o resto do app, pra não escorregar de dia no fuso. */
const hoje = new Date(2026, 8, 28, 12); // 28/09/2026

/** O que o servidor faz com o formulário se a pessoa não mexer no campo Data. */
function mesSalvo(year: number, month: number, entryDate: string) {
  const parsed = monthlyEntrySchema.parse({
    year,
    month,
    category: "EXPENSE",
    parentCategory: "ALIMENTACAO",
    amount: "200",
    // Como o parseEntryForm manda: chave presente, valor undefined quando o campo não existe.
    currency: undefined,
    exchangeRate: undefined,
    repeatMonthly: undefined,
    entryDate,
  });
  return { year: parsed.year, month: parsed.month };
}

describe("defaultEntryDateValue", () => {
  it("lançamento novo no mês de hoje vem com a data de hoje", () => {
    expect(defaultEntryDateValue({ isEditing: false, year: 2026, month: 9, today: hoje })).toBe("2026-09-28");
  });

  it("'Lançar em Março' cai em março, não no mês de hoje", () => {
    const value = defaultEntryDateValue({ isEditing: false, year: 2026, month: 3, today: hoje });
    expect(value).toBe("2026-03-01");
    expect(mesSalvo(2026, 3, value)).toEqual({ year: 2026, month: 3 });
  });

  it("mês de outro ano não vira o ano de hoje", () => {
    const value = defaultEntryDateValue({ isEditing: false, year: 2025, month: 12, today: hoje });
    expect(mesSalvo(2025, 12, value)).toEqual({ year: 2025, month: 12 });
    const futuro = defaultEntryDateValue({ isEditing: false, year: 2027, month: 1, today: hoje });
    expect(mesSalvo(2027, 1, futuro)).toEqual({ year: 2027, month: 1 });
  });

  it("editar lançamento sem data (fatura, parcela) deixa o campo vazio e ele fica no mês dele", () => {
    const value = defaultEntryDateValue({ isEditing: true, year: 2026, month: 8, today: hoje });
    expect(value).toBe("");
    expect(mesSalvo(2026, 8, value)).toEqual({ year: 2026, month: 8 });
  });

  it("editar lançamento com data mantém a data dele", () => {
    expect(
      defaultEntryDateValue({ defaultEntryDate: "2026-08-15", isEditing: true, year: 2026, month: 8, today: hoje }),
    ).toBe("2026-08-15");
  });
});

describe("toDateInputValue", () => {
  it("usa a data local, sem voltar um dia pela conversão pra UTC", () => {
    expect(toDateInputValue(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });
});
