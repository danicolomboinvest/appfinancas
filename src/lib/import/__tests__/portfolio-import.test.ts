import { describe, it, expect } from "vitest";
import { parsePortfolioStatement, guessAssetClass } from "../portfolio-parser";

describe("guessAssetClass", () => {
  it("infers class from ticker suffix", () => {
    expect(guessAssetClass("HGLG11")).toBe("FII");
    expect(guessAssetClass("PETR4")).toBe("ACAO");
    expect(guessAssetClass("ITUB3")).toBe("ACAO");
    expect(guessAssetClass("TSLA34")).toBe("ACAO"); // BDR termina em 34 → trata como ação
  });
});

describe("parsePortfolioStatement", () => {
  it("parses a B3-style CSV with código/quantidade/valor", () => {
    const csv = `Código;Quantidade;Valor
PETR4;100;3.500,00
HGLG11;50;8.000,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toEqual({ ticker: "PETR4", quantity: 100, value: 3500 });
    expect(holdings[1]).toEqual({ ticker: "HGLG11", quantity: 50, value: 8000 });
  });

  it("parses loose text with tickers", () => {
    const text = `Minha carteira:
PETR4 100 acoes 3.500,00
KNRI11 30 cotas 4.200,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings.map((h) => h.ticker)).toEqual(["PETR4", "KNRI11"]);
    expect(holdings[0].quantity).toBe(100);
  });

  it("merges repeated tickers (multiple buy lines)", () => {
    const csv = `Ticker;Quantidade;Valor
PETR4;100;3.500,00
PETR4;50;1.800,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(150);
    expect(holdings[0].value).toBe(5300);
  });

  it("ignores lines without a valid ticker", () => {
    const text = `Saldo em conta: 1.000,00\nPETR4 10 350,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe("PETR4");
  });
});
