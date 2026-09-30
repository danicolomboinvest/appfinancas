import { describe, expect, it } from "vitest";
import { installmentCanonical, installmentDescription, parseInstallment } from "@/lib/entries/recurrence";
import { totalDoLote } from "../total-do-lote";

// Cobertura extra (set/2026): parcelas como chegam da FATURA importada. A leitura da parcela
// mora em lib/entries/recurrence.ts, mas quem cria as parcelas futuras é o import
// (import-actions.ts:642 e :784). Descrições FICTÍCIAS.

describe("parcelas na descrição da fatura", () => {
  it("Pix no crédito parcelado do Nubank ('Parcela 5/5') é a última: nada pra projetar", () => {
    expect(parseInstallment("Pessoa Exemplo - Parcela 5/5")).toEqual({ current: 5, total: 5, confident: true });
  });

  it("'PARC 01 DE 12' e 'PARCELA 13/24' têm certeza", () => {
    expect(parseInstallment("PARC 01 DE 12 LOJA EXEMPLO")).toEqual({ current: 1, total: 12, confident: true });
    expect(parseInstallment("PARCELA 13/24 LOJA EXEMPLO")).toEqual({ current: 13, total: 24, confident: true });
  });

  it("parcela 1/1, total acima de 48 e atual maior que o total não são parcela", () => {
    expect(parseInstallment("LOJA PARC 1/1")).toBeNull();
    expect(parseInstallment("LOJA 1/60 PARC")).toBeNull();
    expect(parseInstallment("LOJA PARC 7/6")).toBeNull();
  });

  it("a parcela seguinte mantém o formato do banco", () => {
    expect(installmentDescription("PARC 01 DE 12 LOJA EXEMPLO", 2, 12)).toBe("PARC 02 DE 12 LOJA EXEMPLO");
    expect(installmentCanonical("PARC 01 DE 12 LOJA EXEMPLO")).toBe("PARC 1 de 12 LOJA EXEMPLO");
  });

  // O regex pegava o PRIMEIRO "N/T" da descrição. Quando a data da compra vem antes da parcela
  // ("LOJA 03/09 PARCELA 2/10"), ele lia "3 de 9" COM certeza (a palavra "parcela" está lá) e o
  // import criava 6 parcelas que não existem; com "09/06" antes (9 > 6) a parcela sumia.
  it("data antes de 'PARCELA n/t' não é lida como a parcela", () => {
    expect(parseInstallment("LOJA EXEMPLO 03/09 PARCELA 2/10")).toEqual({ current: 2, total: 10, confident: true });
    // A parcela seguinte troca o "2/10", não a data da compra.
    expect(installmentDescription("LOJA EXEMPLO 03/09 PARCELA 2/10", 3, 10)).toBe("LOJA EXEMPLO 03/09 PARCELA 3/10");
    expect(installmentCanonical("LOJA EXEMPLO 03/09 PARCELA 02/10")).toBe("LOJA EXEMPLO 03/09 PARCELA 2/10");
  });

  it("data impossível como parcela (9/6) não esconde a parcela de verdade", () => {
    expect(parseInstallment("LOJA EXEMPLO 09/06 PARCELA 3/10")).toEqual({ current: 3, total: 10, confident: true });
  });
});

describe("totalDoLote: bordas da fatura parcelada", () => {
  it("fatura que vira o ano: dezembro é o mês da fatura, janeiro são as parcelas projetadas", () => {
    const lote = [
      { amount: 100, category: "EXPENSE", year: 2026, month: 12 },
      { amount: 50, category: "EXPENSE", year: 2026, month: 12 },
      { amount: 50, category: "EXPENSE", year: 2027, month: 1 },
    ];
    expect(totalDoLote("fatura", lote)).toBe(150);
  });

  it("renda dentro da fatura não soma no total da fatura", () => {
    expect(totalDoLote("fatura", [
      { amount: 100, category: "EXPENSE", year: 2026, month: 9 },
      { amount: 30, category: "INCOME", year: 2026, month: 9 },
    ])).toBe(100);
  });

  it("arredonda centavos da soma (0,1 + 0,2)", () => {
    expect(totalDoLote("extrato", [
      { amount: 0.1, category: "INCOME", year: 2026, month: 9 },
      { amount: 0.2, category: "INCOME", year: 2026, month: 9 },
    ])).toBe(0.3);
  });
});
