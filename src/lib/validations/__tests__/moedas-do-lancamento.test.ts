import { describe, expect, it } from "vitest";
import { monthlyEntrySchema } from "../monthly-entry.schema";
import { mensagemDeValidacao } from "../mensagem";
import { CURRENCY_CODES } from "@/lib/money";

const base = { year: "2026", month: "10", amount: "15000.00", description: "", subcategory: "Salário", entryDate: "2026-10-12" };

describe("lançamento em qualquer moeda do app (cliente em Israel, 12/10/2026)", () => {
  for (const moeda of ["ILS", "USD", "EUR", "BRL", "GBP", "ARS", "CLP"]) {
    it(`entrada e gasto em ${moeda} passam na validação`, () => {
      expect(monthlyEntrySchema.safeParse({ ...base, category: "INCOME", currency: moeda }).success).toBe(true);
      expect(monthlyEntrySchema.safeParse({ ...base, category: "EXPENSE", parentCategory: "LAZER", currency: moeda }).success).toBe(true);
    });
  }
  it("todas as moedas que o app oferece são aceitas", () => {
    for (const moeda of CURRENCY_CODES) expect(monthlyEntrySchema.safeParse({ ...base, category: "INCOME", currency: moeda }).success, moeda).toBe(true);
  });
  it("nunca mostra 'Invalid input': o erro vira português claro", () => {
    const r = monthlyEntrySchema.safeParse({ ...base, category: "INCOME", currency: "XYZ" });
    expect(r.success).toBe(false);
    expect(mensagemDeValidacao(r.error!.issues[0])).toMatch(/^(Essa moeda não está na lista do app.|Confira a moeda: do jeito que está, não deu para salvar.)$/);
    expect(mensagemDeValidacao({ message: "Invalid input", path: ["amount"] })).toBe("Confira o valor: do jeito que está, não deu para salvar.");
    expect(mensagemDeValidacao({ message: "Escolha uma categoria pro gasto.", path: ["parentCategory"] })).toBe("Escolha uma categoria pro gasto.");
    expect(mensagemDeValidacao(undefined)).toBe("Confira os campos e tente de novo.");
  });
});
