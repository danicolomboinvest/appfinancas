import { describe, expect, it } from "vitest";
import { planPositionUpdate, summarizeRows, valueAfterImport } from "../import-position";

/**
 * Reimportar a posição da corretora em ativos que já existem. Os dois casos que motivaram:
 * extrato só com Código e Quantidade zerava o valor do ativo, e PETR4 em duas linhas (50 + 50)
 * terminava com 150 depois de importar "PETR4 = 100".
 */
const row = (id: string, quantity: number | null, currentValue: number, currentUnitPrice: number | null = null) => ({
  id,
  quantity,
  currentValue,
  currentUnitPrice,
});

describe("planPositionUpdate", () => {
  it("extrato sem valor não zera o ativo: estima pela cotação salva", () => {
    const plano = planPositionUpdate([row("a", 100, 4000, 40)], { quantity: 200, value: 0, investedValue: null });
    expect(plano).toEqual([{ id: "a", quantity: 200, currentValue: 8000 }]);
  });

  it("sem cotação salva, estima pelo valor ÷ quantidade de antes", () => {
    const plano = planPositionUpdate([row("a", 100, 40000)], { quantity: 110, value: 0, investedValue: null });
    expect(plano[0].currentValue).toBe(44000);
  });

  it("sem valor e sem como estimar, o valor salvo fica como está", () => {
    const plano = planPositionUpdate([row("a", null, 40000)], { quantity: 200, value: 0, investedValue: null });
    expect(plano).toEqual([{ id: "a", quantity: 200 }]);
    expect(plano[0].currentValue).toBeUndefined();
  });

  it("com valor no extrato, vale o do extrato", () => {
    const plano = planPositionUpdate([row("a", 100, 4000, 40)], { quantity: 120, value: 5000, investedValue: 4500 });
    expect(plano).toEqual([{ id: "a", quantity: 120, currentValue: 5000, investedValue: 4500 }]);
  });

  it("mesmo papel em duas linhas: a posição nova é repartida, não somada", () => {
    const plano = planPositionUpdate([row("casa", 50, 1500), row("liberdade", 50, 1500)], { quantity: 100, value: 3200, investedValue: null });
    expect(plano).toEqual([
      { id: "casa", quantity: 50, currentValue: 1600 },
      { id: "liberdade", quantity: 50, currentValue: 1600 },
    ]);
    const totalQtd = plano.reduce((s, u) => s + (u.quantity ?? 0), 0);
    expect(totalQtd).toBe(100);
  });

  it("repartição proporcional com arredondamento: a soma bate exatamente", () => {
    const plano = planPositionUpdate([row("a", 1, 10), row("b", 2, 20)], { quantity: 100, value: 1000, investedValue: 900 });
    expect(plano.reduce((s, u) => s + (u.quantity ?? 0), 0)).toBeCloseTo(100, 6);
    expect(Math.round(plano.reduce((s, u) => s + (u.currentValue ?? 0), 0) * 100) / 100).toBe(1000);
    expect(Math.round(plano.reduce((s, u) => s + (u.investedValue ?? 0), 0) * 100) / 100).toBe(900);
    expect(plano[1].quantity).toBeCloseTo(66.666667, 6);
  });

  it("linhas sem quantidade são repartidas pelo valor", () => {
    const plano = planPositionUpdate([row("a", null, 3000), row("b", null, 1000)], { quantity: 0, value: 8000, investedValue: null });
    expect(plano).toEqual([
      { id: "a", currentValue: 6000 },
      { id: "b", currentValue: 2000 },
    ]);
  });
});

describe("revisão: antes e depois", () => {
  it("o antes é a soma das linhas do papel", () => {
    expect(summarizeRows([row("casa", 50, 1500), row("liberdade", 50, 1500)])).toEqual({ quantity: 100, value: 3000 });
    expect(summarizeRows([row("cdb", null, 1000)])).toEqual({ quantity: null, value: 1000 });
  });

  it("o depois nunca é R$ 0 quando o extrato não trouxe valor", () => {
    expect(valueAfterImport([row("a", 100, 40000)], { quantity: 200, value: 0, investedValue: null })).toBe(80000);
    expect(valueAfterImport([row("a", null, 40000)], { quantity: 200, value: 0, investedValue: null })).toBe(40000);
    expect(valueAfterImport([row("a", 100, 40000)], { quantity: 200, value: 90000, investedValue: null })).toBe(90000);
  });
});
