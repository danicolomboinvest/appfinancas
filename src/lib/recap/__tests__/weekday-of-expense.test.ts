import { describe, expect, it } from "vitest";
import { weekdayOfExpense } from "../monthly";

describe("weekdayOfExpense", () => {
  it("usa o dia do lançamento (coluna só de data, meia-noite UTC)", () => {
    // 2026-09-01 foi uma terça-feira.
    expect(weekdayOfExpense({ entryDate: new Date("2026-09-01T00:00:00Z"), createdAt: new Date("2026-01-10T12:00:00Z"), importBatchId: null }, 2026, 9)).toBe(2);
  });

  it("sem dia: compra de fatura importada não cai num dia da semana qualquer", () => {
    expect(weekdayOfExpense({ entryDate: null, createdAt: new Date("2026-09-15T15:00:00Z"), importBatchId: "lote" }, 2026, 9)).toBeNull();
  });

  it("sem dia: cópia recorrente ou parcela criada noutro mês fica de fora", () => {
    expect(weekdayOfExpense({ entryDate: null, createdAt: new Date("2026-01-10T15:00:00Z"), importBatchId: null }, 2026, 9)).toBeNull();
  });

  it("sem dia, digitado à mão dentro do mês: vale o dia em que foi lançado (fuso do Brasil)", () => {
    // 2026-09-16 01:00 UTC = 15/09 22h em Brasília, uma terça-feira.
    expect(weekdayOfExpense({ entryDate: null, createdAt: new Date("2026-09-16T01:00:00Z"), importBatchId: null }, 2026, 9)).toBe(2);
  });
});
