import { describe, expect, it } from "vitest";
import { EXEMPLO_CONSORCIO, EXEMPLO_FINANCIAR, entradaConsorcio, entradaFinanciar, revendaPelaProporcao, valorInicialDoBem } from "../entradas";
import { vereditoCarro, vereditoFinanciar } from "../vereditos";

/** Os erros achados no teste de 14/10/2026, um por bloco. */
describe("carro: a revenda acompanha o preço", () => {
  it("75% do preço, de 100 em 100, como o arrastar", () => {
    expect(revendaPelaProporcao(45000.5, 0.75)).toBe(33800);
    expect(revendaPelaProporcao(100000, 0.75)).toBe(75000);
  });
  it("fica dentro da régua de 40% a 95%", () => {
    expect(revendaPelaProporcao(100000, 2)).toBe(95000);
    expect(revendaPelaProporcao(100000, 0)).toBe(40000);
    expect(revendaPelaProporcao(100000, Number.NaN)).toBe(75000);
  });
  it("preço zero não inventa revenda", () => {
    expect(revendaPelaProporcao(0, 0.75)).toBe(0);
  });
  it("carro de R$ 45 mil não sai valendo mais que o preço depois de 2 anos", () => {
    const v = { carPrice: 45000, priceAfter1Year: 0, priceAfter2Years: revendaPelaProporcao(45000, 0.75), monthlyFuelCost: 400, subscriptionMonthlyFee: 2500, annualFixedCosts: 4000, opportunityCostMonthlyRate: 0.008 };
    const r = vereditoCarro(v);
    expect(r.partesComprar.perdaNaRevenda).toBeGreaterThan(0);
  });
});

describe("entrada nunca maior que o bem", () => {
  it("financiar: imóvel menor que a entrada não vira financiamento negativo", () => {
    const e = entradaFinanciar({ ...EXEMPLO_FINANCIAR, propertyValue: 80000, downPayment: 100000 });
    expect(e.downPayment).toBe(80000);
    expect(vereditoFinanciar({ ...EXEMPLO_FINANCIAR, propertyValue: 80000, downPayment: 100000 }).r.financedAmount).toBe(0);
  });
  it("abaixo do valor, nada muda (centavos inclusos)", () => {
    expect(entradaFinanciar({ ...EXEMPLO_FINANCIAR, downPayment: 90000.12 }).downPayment).toBe(90000.12);
  });
  it("consórcio: a entrada do financiamento para no valor do bem", () => {
    expect(entradaConsorcio({ ...EXEMPLO_CONSORCIO, creditValue: 15000, financingDownPayment: 20000 }).financingDownPayment).toBe(15000);
    expect(entradaConsorcio({ ...EXEMPLO_CONSORCIO }).financingDownPayment).toBe(20000);
  });
});

describe("consórcio: o preço de partida", () => {
  it("com a meta de carro, é o valor da meta", () => {
    expect(valorInicialDoBem("meta", 30000)).toBe(30000);
  });
  it("meta sem valor, outro bem ou nada escolhido: o exemplo", () => {
    expect(valorInicialDoBem("meta", 0)).toBe(100000);
    expect(valorInicialDoBem("outro", 30000)).toBe(100000);
    expect(valorInicialDoBem(null, undefined)).toBe(100000);
  });
  it("imóvel: R$ 300 mil", () => {
    expect(valorInicialDoBem("imovel", 30000)).toBe(300000);
  });
});
