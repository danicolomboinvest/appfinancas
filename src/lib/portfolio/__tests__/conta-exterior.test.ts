import { describe, expect, it } from "vitest";
import {
  TICKER_EUA,
  atualizacaoDoExterior,
  cambioDoAtivo,
  ehDoExterior,
  naMoedaDoApp,
  nativoAposAporte,
  nativoAposResgate,
  totaisPorConta,
} from "../conta-exterior";

describe("conta no exterior", () => {
  it("BRL é conta Brasil; o resto é exterior", () => {
    expect(ehDoExterior("BRL")).toBe(false);
    expect(ehDoExterior("USD")).toBe(true);
    expect(ehDoExterior(null)).toBe(false);
  });

  it("ticker americano não confunde com B3", () => {
    expect(TICKER_EUA.test("VOO")).toBe(true);
    expect(TICKER_EUA.test("BRK.B")).toBe(true);
    expect(TICKER_EUA.test("PETR4")).toBe(false);
    expect(TICKER_EUA.test("AAPL34")).toBe(false);
  });

  it("converte dólar em reais nos centavos", () => {
    expect(naMoedaDoApp(2000, 5.0224)).toBe(10044.8);
  });

  it("câmbio: o gravado, ou reais ÷ dólares", () => {
    expect(cambioDoAtivo({ currentValue: 10000, nativeCurrentValue: 2000, nativeInvestedValue: null, exchangeRate: 5.1 })).toBe(5.1);
    expect(cambioDoAtivo({ currentValue: 10000, nativeCurrentValue: 2000, nativeInvestedValue: null, exchangeRate: null })).toBe(5);
    expect(cambioDoAtivo({ currentValue: 10000, nativeCurrentValue: null, nativeInvestedValue: null, exchangeRate: null })).toBeNull();
  });

  it("aporte em reais entra em dólar pelo câmbio do ativo", () => {
    const depois = nativoAposAporte({ currentValue: 10000, nativeCurrentValue: 2000, nativeInvestedValue: 1800, exchangeRate: 5 }, 500);
    expect(depois).toEqual({ nativeCurrentValue: 2100, nativeInvestedValue: 1900 });
  });

  it("aporte em ativo da conta Brasil não mexe em dólar", () => {
    expect(nativoAposAporte({ currentValue: 10000, nativeCurrentValue: null, nativeInvestedValue: null, exchangeRate: null }, 500)).toBeNull();
  });

  it("resgate tira a mesma fração do lado em dólar", () => {
    expect(nativoAposResgate({ currentValue: 10000, nativeCurrentValue: 2000, nativeInvestedValue: 1800, exchangeRate: 5 }, 0.25)).toEqual({
      nativeCurrentValue: 1500,
      nativeInvestedValue: 1350,
    });
  });

  it("cotação da noite: quantidade × preço em US$, convertido pelo dólar do dia", () => {
    expect(atualizacaoDoExterior({ quantity: 3, nativeCurrentValue: 2000, precoNativo: 714.34, cambio: 5.02 })).toEqual({
      nativeCurrentValue: 2143.02,
      currentValue: 10757.96,
      exchangeRate: 5.02,
      currentUnitPrice: 3585.9868,
    });
  });

  it("sem cotação, só o dólar do dia muda o valor em reais", () => {
    expect(atualizacaoDoExterior({ quantity: null, nativeCurrentValue: 2000, precoNativo: null, cambio: 5.1 })).toEqual({
      nativeCurrentValue: 2000,
      currentValue: 10200,
      exchangeRate: 5.1,
    });
  });

  it("sem câmbio, não grava nada", () => {
    expect(atualizacaoDoExterior({ quantity: 3, nativeCurrentValue: 2000, precoNativo: 714, cambio: null })).toBeNull();
  });

  it("totais por conta", () => {
    const t = totaisPorConta([
      { currency: "BRL", currentValue: 30000, nativeCurrentValue: null },
      { currency: "USD", currentValue: 10000, nativeCurrentValue: 2000 },
      { currency: "USD", currentValue: 5000, nativeCurrentValue: 1000 },
    ]);
    expect(t).toEqual({ brasil: 30000, exterior: 15000, exteriorNativo: { moeda: "USD", valor: 3000 }, quantosNoExterior: 2 });
  });

  it("sem nada fora, o exterior fica zerado", () => {
    expect(totaisPorConta([{ currency: "BRL", currentValue: 100, nativeCurrentValue: null }]).quantosNoExterior).toBe(0);
  });
});
