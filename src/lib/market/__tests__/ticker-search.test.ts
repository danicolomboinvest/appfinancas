import { describe, expect, it } from "vitest";
import { fromBrapi, prettyName, searchCatalogue, type TickerHit } from "../ticker-search";

const CAT: TickerHit[] = [
  { ticker: "PETR4", name: "Petroleo Brasileiro Petrobras", kind: "STOCK", volume: 50_000_000 },
  { ticker: "PETR3", name: "Petroleo Brasileiro Petrobras", kind: "STOCK", volume: 12_000_000 },
  { ticker: "RECV3", name: "Petrorecôncavo", kind: "STOCK", volume: 1_800_000 },
  { ticker: "VALE3", name: "Vale", kind: "STOCK", volume: 40_000_000 },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", kind: "FII", volume: 100_000 },
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários", kind: "FII", volume: 200_000 },
  { ticker: "AAPL", name: "Apple", kind: "STOCK_INTL", volume: 1 },
];

describe("searchCatalogue", () => {
  it("finds by the company name, not only the code, and puts the most traded first", () => {
    expect(searchCatalogue(CAT, "petro", ["STOCK"]).map((h) => h.ticker)).toEqual(["PETR4", "PETR3", "RECV3"]);
    expect(searchCatalogue(CAT, "kinea", ["FII"]).map((h) => h.ticker)).toEqual(["KNCR11", "KNRI11"]);
  });

  it("ignores accents and case, and respects the kind asked", () => {
    expect(searchCatalogue(CAT, "Imobiliaria", ["FII"]).map((h) => h.ticker)).toEqual(["KNRI11"]);
    expect(searchCatalogue(CAT, "apple", ["STOCK"])).toEqual([]);
    expect(searchCatalogue(CAT, "apple", ["STOCK_INTL"])[0].ticker).toBe("AAPL");
  });

  it("with nothing typed, lists the most traded so someone who knows no code can scroll", () => {
    expect(searchCatalogue(CAT, "", ["STOCK"]).map((h) => h.ticker)).toEqual(["PETR4", "VALE3", "PETR3", "RECV3"]);
    const semNome: TickerHit = { ticker: "XPTO3", name: "", kind: "STOCK", volume: 99_000_000 };
    expect(searchCatalogue([semNome, ...CAT], "", ["STOCK"]).map((h) => h.ticker)).toEqual(["PETR4", "VALE3", "PETR3", "RECV3", "XPTO3"]);
  });
});

describe("fromBrapi", () => {
  it("maps types, drops the fractional duplicate and gives FIIs their known name", () => {
    const hits = fromBrapi([
      { stock: "PETR4", name: "PETROLEO BRASILEIRO S.A. PETROBRAS", volume: 10, type: "stock", subType: "stock" },
      { stock: "PETR4F", name: "PETROLEO BRASILEIRO S.A. PETROBRAS", volume: 1, type: "stock", subType: "stock" },
      { stock: "HGLG11", name: "HGLG11", volume: 5, type: "fund", subType: "fii" },
      { stock: "BOVA11", name: "BOVA11", volume: 5, type: "fund", subType: "etf" },
      { stock: "AAPL34", name: "AAPL34", volume: 5, type: "bdr", subType: "bdr" },
      { stock: "XPTO11", name: "XPTO", volume: 5, type: "fund", subType: "fip" },
    ]);
    expect(hits.map((h) => [h.ticker, h.kind, h.name])).toEqual([
      ["PETR4", "STOCK", "Petrobras"],
      ["HGLG11", "FII", "CSHG Logística"],
      ["BOVA11", "ETF", "iShares Ibovespa"],
      ["AAPL34", "BDR", "Apple (BDR)"],
    ]);
    // A razão social vira apelido: "petroleo" ainda acha a Petrobras.
    expect(hits[0].alias).toBe("Petroleo Brasileiro Petrobras");
    expect(searchCatalogue(hits, "petroleo", ["STOCK"]).map((h) => h.ticker)).toEqual(["PETR4"]);
  });
});

describe("prettyName", () => {
  it("drops legal suffixes and title-cases", () => {
    expect(prettyName("VALE S.A.", "VALE3")).toBe("Vale");
    expect(prettyName("ITAUSA S/A", "ITSA4")).toBe("Itausa");
    expect(prettyName("BCO DO BRASIL S.A.", "BBAS3")).toBe("Bco do Brasil");
    expect(prettyName("HGLG11", "HGLG11")).toBe("");
  });
});
