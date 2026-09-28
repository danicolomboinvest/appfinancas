import { describe, expect, it } from "vitest";
import { allocationsToRestore, assetAfterContribution } from "../contribution-link";

/**
 * O que acontece com o ativo quando um aporte do mês entra nele, e o que volta junto quando
 * ela desfaz a exclusão de um aporte já distribuído.
 */
describe("assetAfterContribution", () => {
  it("investido desconhecido continua desconhecido (não vira lucro de 2000%)", () => {
    const depois = assetAfterContribution({ investedValue: null, currentValue: 10000, quantity: null, currentUnitPrice: null }, 500);
    expect(depois.investedValue).toBeNull();
    expect(depois.currentValue).toBe(10500);
    expect(depois.quantityEstimated).toBe(false);
  });

  it("renda fixa sem quantidade soma no investido e no atual, sem inventar quantidade", () => {
    const depois = assetAfterContribution({ investedValue: 9000, currentValue: 10000, quantity: null, currentUnitPrice: null }, 500);
    expect(depois).toEqual({ investedValue: 9500, currentValue: 10500, quantity: null, quantityEstimated: false });
  });

  it("ação com quantidade ganha cotas pela cotação: a próxima atualização não apaga o aporte", () => {
    const depois = assetAfterContribution({ investedValue: 3000, currentValue: 3000, quantity: 100, currentUnitPrice: 30 }, 1000);
    expect(depois.quantityEstimated).toBe(true);
    expect(depois.quantity).toBeCloseTo(133.333333, 6);
    // O que "Atualizar cotações" faz depois: quantidade × preço. Com a cotação igual, nada some.
    expect(Math.round(depois.quantity! * 30 * 100) / 100).toBeCloseTo(4000, 1);
    expect(depois.investedValue).toBe(4000);
    // Preço médio continua R$ 30, não R$ 40.
    expect(depois.investedValue! / depois.quantity!).toBeCloseTo(30, 4);
  });

  it("sem cotação salva, usa valor atual ÷ quantidade como preço", () => {
    const depois = assetAfterContribution({ investedValue: 2000, currentValue: 2500, quantity: 100, currentUnitPrice: null }, 500);
    expect(depois.quantity).toBe(120);
  });
});

describe("allocationsToRestore", () => {
  it("devolve as distribuições dos ativos que ainda são dela", () => {
    const own = new Set(["cdb", "petr"]);
    expect(allocationsToRestore([{ assetId: "cdb", amount: 600 }, { assetId: "petr", amount: 400 }], own, 1000)).toEqual([
      { assetId: "cdb", amount: 600 },
      { assetId: "petr", amount: 400 },
    ]);
  });

  it("ignora ativo que não é dela ou que foi apagado", () => {
    expect(allocationsToRestore([{ assetId: "de-outra", amount: 500 }, { assetId: "cdb", amount: 500 }], new Set(["cdb"]), 1000)).toEqual([
      { assetId: "cdb", amount: 500 },
    ]);
  });

  it("nunca distribui mais do que o próprio aporte", () => {
    expect(allocationsToRestore([{ assetId: "cdb", amount: 900 }, { assetId: "petr", amount: 900 }], new Set(["cdb", "petr"]), 1000)).toEqual([
      { assetId: "cdb", amount: 900 },
      { assetId: "petr", amount: 100 },
    ]);
  });

  it("snapshot sem distribuições (lançamento antigo, ou não era aporte) não cria nada", () => {
    expect(allocationsToRestore(undefined, new Set(["cdb"]), 1000)).toEqual([]);
  });
});
