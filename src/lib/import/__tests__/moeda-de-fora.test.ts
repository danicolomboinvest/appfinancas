import { describe, expect, it } from "vitest";
import { confirmadasDaMoedaDeFora, conversaoDaCompra, moedaDeForaValida, reaisDigitados, somaDigitada, type CompraParaPreencher } from "../moeda-de-fora";

const apify: CompraParaPreencher = {
  nome: "Apify", data: "2026-10-10", texto: "US$ 19,00", moeda: "USD", valorDeFora: 19,
  parentCategory: null, customCategoryId: null, subcategory: null,
};

describe("compra em dólar preenchida na revisão", () => {
  it("sem valor digitado, a compra fica de fora", () => {
    expect(confirmadasDaMoedaDeFora([apify], {})).toEqual([]);
    expect(confirmadasDaMoedaDeFora([apify], { 0: 0 })).toEqual([]);
    expect(confirmadasDaMoedaDeFora([apify], { 0: undefined })).toEqual([]);
  });
  it("com o valor em real, entra como gasto no nome da loja, com o dólar nos campos de outra moeda", () => {
    const [item] = confirmadasDaMoedaDeFora([apify], { 0: 104.5 });
    expect(item).toMatchObject({
      date: "2026-10-10", description: "Apify", amount: 104.5, category: "EXPENSE", parentCategory: "OUTROS",
      moedaDeFora: { moeda: "USD", valor: 19 },
    });
    expect(item.description).not.toMatch(/US\$/);
  });
  it("usa a categoria sugerida quando existe", () => {
    const [item] = confirmadasDaMoedaDeFora([{ ...apify, parentCategory: "LAZER" }], { 0: 50 });
    expect(item.parentCategory).toBe("LAZER");
  });
  it("só as preenchidas entram, cada uma pelo seu índice", () => {
    const outra = { ...apify, nome: "Outra", valorDeFora: 5 };
    const r = confirmadasDaMoedaDeFora([apify, outra], { 1: 27 });
    expect(r.map((i) => [i.description, i.amount])).toEqual([["Outra", 27]]);
  });
  it("conversão: guarda o valor de fora e a cotação", () => {
    expect(conversaoDaCompra({ moeda: "USD", valor: 19 }, 104.5)).toEqual({ originalAmount: 19, originalCurrency: "USD", exchangeRate: 5.5 });
  });
  it("sem moeda legível, não inventa conversão", () => {
    expect(conversaoDaCompra({ moeda: null, valor: 19 }, 104.5)).toEqual({});
    expect(conversaoDaCompra({ moeda: "JPY", valor: 19 }, 104.5)).toEqual({});
    expect(conversaoDaCompra({ moeda: "USD", valor: 19 }, 0)).toEqual({});
    expect(moedaDeForaValida("EUR")).toBe("EUR");
  });
  it("valor digitado absurdo é ignorado; a soma conta só o que vale", () => {
    expect(reaisDigitados(-3)).toBeNull();
    expect(reaisDigitados(NaN)).toBeNull();
    expect(reaisDigitados(1e9)).toBeNull();
    expect(reaisDigitados(10.456)).toBe(10.46);
    expect(somaDigitada({ 0: 10.1, 1: 20.2, 2: 99 }, 2)).toBe(30.3);
  });
});
