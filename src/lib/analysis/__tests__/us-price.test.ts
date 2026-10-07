import { describe, expect, it } from "vitest";
import { parseUsdText, parseYahooPrice } from "../us-price";

describe("cotação americana", () => {
  it("lê o preço do Yahoo em dólar", () => {
    expect(parseYahooPrice({ chart: { result: [{ meta: { currency: "USD", regularMarketPrice: 714.34 } }] } })).toBe(714.34);
  });

  it("recusa preço que não é em dólar ou ticker que não existe", () => {
    expect(parseYahooPrice({ chart: { result: [{ meta: { currency: "BRL", regularMarketPrice: 38 } }] } })).toBeNull();
    expect(parseYahooPrice({ chart: { result: null, error: { code: "Not Found" } } })).toBeNull();
    expect(parseYahooPrice(null)).toBeNull();
  });

  it("lê o US$ do investidor10 e ignora o R$ do lado", () => {
    expect(parseUsdText(" Valor atual US$ 716,86 R$ 3.598,64 ")).toBe(716.86);
    expect(parseUsdText("Cotação US$ 1.334,88")).toBe(1334.88);
    expect(parseUsdText("R$ 38,10")).toBeNull();
  });
});
