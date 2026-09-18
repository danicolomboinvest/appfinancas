import { describe, expect, it } from "vitest";
import { idealBudgetSplit, idealBandRange, bandForIncome } from "../ideal-budget";
import { PARENT_CATEGORIES } from "@/lib/categories";

const soma = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

describe("idealBudgetSplit", () => {
  it("divide o que sobra e a soma fecha exatamente, sem centavo sem dono", () => {
    for (const [renda, sobra] of [
      [16000, 12800],
      [16000, 14400],
      [12000, 9600],
      [5000, 4500],
      [3000, 2850],
      [7777, 6111],
    ] as const) {
      expect(soma(idealBudgetSplit(sobra, renda))).toBe(sobra);
    }
  });

  it("quem ganha menos compromete mais com moradia e comida", () => {
    const baixa = idealBudgetSplit(4000, 4000);
    const alta = idealBudgetSplit(4000, 20000);
    expect(baixa.ALIMENTACAO).toBeGreaterThan(alta.ALIMENTACAO);
    expect(baixa.MORADIA).toBeGreaterThan(alta.MORADIA);
    expect(alta.LAZER).toBeGreaterThan(baixa.LAZER);
  });

  it("categoria criada pela pessoa sai do bolo antes, e a soma continua batendo", () => {
    const d = idealBudgetSplit(12800, 16000, { reserved: 800 });
    expect(soma(d)).toBe(12000);
  });

  it("sem sobra, não sugere nada (em vez de inventar valores)", () => {
    expect(soma(idealBudgetSplit(0, 16000))).toBe(0);
    expect(soma(idealBudgetSplit(-500, 16000))).toBe(0);
    expect(soma(idealBudgetSplit(1000, 16000, { reserved: 5000 }))).toBe(0);
  });

  it("toda categoria do app entra na referência e cada faixa soma 100%", () => {
    for (const renda of [3000, 10000, 30000]) {
      const shares = bandForIncome(renda).shares;
      for (const c of PARENT_CATEGORIES) expect(shares[c]).toBeGreaterThan(0);
      expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });

  it("devolve a faixa em número (a tela escreve com a moeda escolhida, sem R$ cravado)", () => {
    expect(idealBandRange(4000)).toEqual({ from: 0, upTo: 5000 });
    expect(idealBandRange(10000)).toEqual({ from: 5000, upTo: 15000 });
    expect(idealBandRange(16000)).toEqual({ from: 15000, upTo: null });
  });
});
