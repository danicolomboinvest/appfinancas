import { describe, expect, it } from "vitest";
import { totalDoLote } from "../total-do-lote";

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
