import { describe, expect, it } from "vitest";
import { assetAfterWithdrawal, planAllocationLines } from "../contribution-link";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";

/**
 * Resgate (30/09/2026): cliente subiu o extrato, o resgate voltou pro mês e o investimento nunca
 * diminuía. Resgate agora é guardado NEGATIVO, e a carteira pergunta de qual investimento saiu.
 */
describe("assetAfterWithdrawal", () => {
  it("tirar tudo zera valor atual e investido", () => {
    expect(assetAfterWithdrawal({ investedValue: 1000, currentValue: 1100, quantity: null, currentUnitPrice: null }, 1100)).toEqual({
      investedValue: 0,
      currentValue: 0,
      quantity: null,
      quantityEstimated: false,
    });
  });

  it("tirar metade deixa metade do investido: não inventa lucro nem prejuízo", () => {
    const r = assetAfterWithdrawal({ investedValue: 1000, currentValue: 1200, quantity: null, currentUnitPrice: null }, 600);
    expect(r.currentValue).toBe(600);
    expect(r.investedValue).toBe(500);
  });

  it("investido desconhecido continua desconhecido", () => {
    expect(assetAfterWithdrawal({ investedValue: null, currentValue: 500, quantity: null, currentUnitPrice: null }, 200).investedValue).toBeNull();
  });

  it("ativo com quantidade perde a mesma fração das cotas (estimativa, a tela avisa)", () => {
    const r = assetAfterWithdrawal({ investedValue: 900, currentValue: 1000, quantity: 10, currentUnitPrice: 100 }, 250);
    expect(r.quantity).toBe(7.5);
    expect(r.quantityEstimated).toBe(true);
    expect(r.currentValue).toBe(750);
  });

  it("nunca fica negativo", () => {
    const r = assetAfterWithdrawal({ investedValue: 100, currentValue: 100, quantity: null, currentUnitPrice: null }, 150);
    expect(r.currentValue).toBe(0);
    expect(r.investedValue).toBe(0);
  });
});

describe("planAllocationLines com resgate", () => {
  it("dois resgates no mês são consumidos em ordem, como os aportes", () => {
    expect(planAllocationLines([{ entryId: "r1", pending: 300 }, { entryId: "r2", pending: 200 }], [{ assetId: "cdb", amount: 400 }])).toEqual([
      { entryId: "r1", assetId: "cdb", amount: 300 },
      { entryId: "r2", assetId: "cdb", amount: 100 },
    ]);
  });
});

describe("formulário: Resgatei", () => {
  // Como o formulário manda (parseEntryForm passa todos os campos, vazios quando não usados).
  const base = { year: 2026, month: 9, amount: "500", category: "INVESTMENT_CONTRIBUTION", exchangeRate: "", repeatMonthly: "" };
  it("aceita resgate no guardado, e o valor do formulário continua positivo (o sinal é do servidor)", () => {
    const r = monthlyEntrySchema.safeParse({ ...base, resgate: "on" });
    expect(r.success && r.data.resgate).toBe(true);
    expect(r.success && r.data.amount).toBe(500);
  });
  it("resgate marcado num gasto ou numa renda é recusado", () => {
    expect(monthlyEntrySchema.safeParse({ ...base, category: "INCOME", resgate: "on" }).success).toBe(false);
  });
  it("sem a marca, guardado é aporte como sempre", () => {
    const r = monthlyEntrySchema.safeParse(base);
    expect(r.success && r.data.resgate).toBe(false);
  });
});
