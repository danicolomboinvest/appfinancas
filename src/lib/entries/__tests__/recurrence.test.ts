import { describe, expect, it } from "vitest";
import { descricaoComparavel, detectRecurring, installmentCanonical, installmentDescription, parseInstallment, type RecurrenceEntry } from "../recurrence";

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
    expect(parseInstallment("MAGAZINE LUIZA 03/10")).toEqual({ current: 3, total: 10, confident: false });
    expect(parseInstallment("Parcela 2 de 6 - Notebook")).toEqual({ current: 2, total: 6, confident: true });
    expect(parseInstallment("IFOOD")).toBeNull();
    expect(parseInstallment("PIX 11/09")).toBeNull();
  });

  it("só tem CERTEZA quando não dá pra confundir com data — é o que autoriza criar os meses seguintes", () => {
    // "POSTO SHELL 03/09" é 3 de setembro, não parcela 3 de 9: sem certeza, nada é criado no futuro.
    expect(parseInstallment("POSTO SHELL 03/09")?.confident).toBe(false);
    expect(parseInstallment("UBER *TRIP 02/05")?.confident).toBe(false);
    // Mês nenhum é 18 ou 24: aí é parcela, sem dúvida.
    expect(parseInstallment("MOVEIS 03/18")?.confident).toBe(true);
    expect(parseInstallment("GELADEIRA 05/24")?.confident).toBe(true);
    // A palavra resolve a dúvida.
    expect(parseInstallment("MAGALU PARC 03/10")?.confident).toBe(true);
    expect(parseInstallment("Parcela 3/10 TV")?.confident).toBe(true);
  });

  it("(N/T) entre parênteses é parcela com certeza: é como o BTG escreve, e data não vem assim", () => {
    expect(parseInstallment("Amazon Marketplace Cc (9/10)")).toEqual({ current: 9, total: 10, confident: true });
    expect(parseInstallment("Mercado Pago (6/6)")).toEqual({ current: 6, total: 6, confident: true });
    expect(parseInstallment("Hospital Exemplo ( 4/5 )")?.confident).toBe(true);
    // Só um dos lados não é parênteses de parcela.
    expect(parseInstallment("LOJA (CENTRO) 03/09")?.confident).toBe(false);
  });

  it("rewrites the installment number for the next months", () => {
    expect(installmentDescription("MAGAZINE LUIZA 03/10", 4, 10)).toBe("MAGAZINE LUIZA 04/10");
    expect(installmentDescription("Parcela 2 de 6 - Notebook", 3, 6)).toBe("Parcela 3 de 6 - Notebook");
  });

  it("escreve a parcela seguinte no MESMO formato do banco — senão a fatura do mês que vem não bate e duplica", () => {
    expect(installmentDescription("NETSHOES PARC 03/06", 4, 6)).toBe("NETSHOES PARC 04/06");
    expect(installmentDescription("Loja - Parcela 3/6", 4, 6)).toBe("Loja - Parcela 4/6");
    expect(installmentDescription("LOJA 2 DE 6", 3, 6)).toBe("LOJA 3 DE 6");
    expect(installmentDescription("PARC 09/12", 10, 12)).toBe("PARC 10/12");
    expect(installmentDescription("Loja Parcela 9/12", 10, 12)).toBe("Loja Parcela 10/12");
  });

  it("installmentCanonical: mesma parcela escrita de jeitos diferentes vira a mesma coisa", () => {
    // "PARC 04/6" é como versões antigas do app gravavam; "PARC 04/06" é como o banco imprime.
    expect(installmentCanonical("NETSHOES PARC 04/06")).toBe("NETSHOES PARC 4/6");
    expect(installmentCanonical("NETSHOES PARC 04/6")).toBe(installmentCanonical("NETSHOES PARC 4/6"));
    expect(installmentCanonical("Parcela 03 DE 6")).toBe("Parcela 3 de 6");
    // O separador fica: é ele que decide se parseInstallment tem certeza.
    expect(installmentCanonical("LOJA 2 de 6")).not.toBe(installmentCanonical("LOJA 2/6"));
    expect(installmentCanonical("IFOOD")).toBe("IFOOD");
  });
});

describe("descricaoComparavel: a mesma parcela escrita por formatos diferentes", () => {
  it("'Loja (2/8)' e 'Loja - Parcela 2/8' são a mesma; parcelas diferentes não", () => {
    expect(descricaoComparavel("Clínica Exemplo (2/8)")).toBe(descricaoComparavel("Clínica Exemplo - Parcela 2/8"));
    expect(descricaoComparavel("CLINICA EXEMPLO PARC 02/08")).toBe(descricaoComparavel("Clinica Exemplo (2/8)"));
    expect(descricaoComparavel("Clínica Exemplo (2/8)")).not.toBe(descricaoComparavel("Clínica Exemplo - Parcela 3/8"));
  });
});
