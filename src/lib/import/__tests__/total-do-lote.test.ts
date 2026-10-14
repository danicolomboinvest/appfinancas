import { describe, expect, it } from "vitest";
import { parcelasProjetadas, totalDoLote } from "../total-do-lote";

const l = (amount: number, category: string, month = 9, year = 2026) => ({ amount, category, year, month });

describe("totalDoLote", () => {
  it("extrato: salário de 5.000 e gastos de 3.000 dão saldo +2.000, não 8.000", () => {
    expect(totalDoLote("extrato", [l(5000, "INCOME"), l(1000, "EXPENSE"), l(2000, "EXPENSE")])).toBe(2000);
  });

  it("extrato: aporte sai do saldo; estorno (gasto negativo) volta", () => {
    expect(totalDoLote("extrato", [l(500, "INVESTMENT_CONTRIBUTION"), l(100, "EXPENSE"), l(-30, "EXPENSE")])).toBe(-570);
  });

  it("fatura: só o mês da fatura, sem as parcelas projetadas pros meses seguintes", () => {
    const parcelas = Array.from({ length: 9 }, (_, i) => l(100, "EXPENSE", ((9 + i) % 12) + 1, 2026 + Math.floor((9 + i) / 12)));
    expect(totalDoLote("fatura", [l(900, "EXPENSE"), l(100, "EXPENSE"), ...parcelas])).toBe(1000);
  });

  it("fatura: estorno desconta; lote vazio dá zero", () => {
    expect(totalDoLote("fatura", [l(300, "EXPENSE"), l(-50, "EXPENSE")])).toBe(250);
    expect(totalDoLote("fatura", [])).toBe(0);
  });
});

describe("totalDoLote com as descrições (cada compra no mês dela, 14/10/2026)", () => {
  const d = (amount: number, description: string, month: number, category = "EXPENSE") => ({ amount, category, year: 2026, month, description });

  it("fatura que fecha no dia 5 grava em dois meses: o total soma os dois", () => {
    // Compras de 10/09 a 04/10: setembro e outubro. Antes só setembro entrava (R$ 300 em vez de 500).
    expect(totalDoLote("fatura", [d(100, "Mercado", 9), d(200, "Posto", 9), d(200, "Farmácia", 10)])).toBe(500);
  });

  it("as parcelas projetadas ficam de fora; a parcela que veio na fatura entra", () => {
    const lote = [d(80, "Netflix", 9), d(150, "Loja Casa Nova - Parcela 2/3", 9), d(150, "Loja Casa Nova - Parcela 3/3", 10), d(-30, "Estorno Loja", 9)];
    expect(totalDoLote("fatura", lote)).toBe(200);
    expect([...parcelasProjetadas(lote)]).toEqual([2]);
  });

  it("duas compras parceladas diferentes na mesma fatura entram as duas", () => {
    const lote = [d(50, "Loja A PARC 01/02", 9), d(70, "Loja B PARC 03/05", 9), d(50, "Loja A PARC 02/02", 10), d(70, "Loja B PARC 04/05", 10), d(70, "Loja B PARC 05/05", 11)];
    expect(totalDoLote("fatura", lote)).toBe(120);
    expect(parcelasProjetadas(lote).size).toBe(3);
  });
});
