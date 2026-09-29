import { describe, expect, it } from "vitest";
import { averagePriceOf, formatQuantityInput, investedToSend, parseQuantityInput } from "../asset-form-values";

/**
 * Formulário de ação/FII. Os casos que motivaram: "1.000" cotas salvava 1 cota, e abrir
 * "Editar" só pra trocar o objetivo mudava o investido de R$ 97.654,32 pra R$ 97.700,00.
 */
describe("parseQuantityInput", () => {
  it("ponto com grupos de 3 dígitos é milhar", () => {
    expect(parseQuantityInput("1.000")).toBe(1000);
    expect(parseQuantityInput("1.500")).toBe(1500);
    expect(parseQuantityInput("12.500")).toBe(12500);
    expect(parseQuantityInput("1.234.567")).toBe(1234567);
  });

  it("vírgula é decimal, com ou sem milhar", () => {
    expect(parseQuantityInput("2,5")).toBe(2.5);
    expect(parseQuantityInput("1.000,5")).toBe(1000.5);
    expect(parseQuantityInput("0,005")).toBe(0.005);
  });

  it("outros pontos são decimais (cripto e o que o próprio app mostrava)", () => {
    expect(parseQuantityInput("0.005")).toBe(0.005);
    expect(parseQuantityInput("1.5")).toBe(1.5);
    expect(parseQuantityInput("133.333333")).toBe(133.333333);
    expect(parseQuantityInput("10")).toBe(10);
  });

  it("texto que não é número vira NaN", () => {
    expect(parseQuantityInput("")).toBeNaN();
    expect(parseQuantityInput("abc")).toBeNaN();
    expect(parseQuantityInput("1.000,5,3")).toBeNaN();
  });

  it("o texto da edição volta pro mesmo número", () => {
    for (const q of [10, 1000, 2.125, 133.333333, 0.005]) {
      expect(parseQuantityInput(formatQuantityInput(q))).toBe(q);
    }
    expect(formatQuantityInput(undefined)).toBe("");
  });
});

describe("investedToSend", () => {
  const original = { quantity: 10000, investedValue: 97654.32 };

  it("edição sem mexer em quantidade nem preço médio mantém o investido salvo", () => {
    const avgPrice = averagePriceOf(original.quantity, original.investedValue);
    expect(avgPrice).toBe(9.77);
    expect(investedToSend({ quantity: 10000, avgPrice, original })).toBe(97654.32);
  });

  it("mudou a quantidade: recalcula pelo preço médio", () => {
    expect(investedToSend({ quantity: 11000, avgPrice: 9.77, original })).toBe(107470);
  });

  it("mudou o preço médio: recalcula", () => {
    expect(investedToSend({ quantity: 10000, avgPrice: 9.8, original })).toBe(98000);
  });

  it("criação: quantidade × preço médio; sem preço, nada", () => {
    expect(investedToSend({ quantity: 10, avgPrice: 30.5 })).toBe(305);
    expect(investedToSend({ quantity: 10, avgPrice: 0 })).toBeUndefined();
    expect(investedToSend({ quantity: NaN, avgPrice: 30 })).toBeUndefined();
  });
});
