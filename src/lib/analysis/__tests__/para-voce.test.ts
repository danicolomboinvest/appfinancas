import { describe, expect, it } from "vitest";
import { classeNaEstrategia } from "../para-voce";

describe("E para você?: classe da estratégia", () => {
  it("ETF que ela não tem não é comparado com Ações Brasil", () => {
    expect(classeNaEstrategia("ETF", [])).toBeNull();
  });

  it("se ela tem o ticker, vale a classe do ativo cadastrado (a mesma da Carteira)", () => {
    expect(classeNaEstrategia("ETF", [{ assetClass: "INTERNACIONAL", fixedIncomeIndex: null }])).toBe("EXTERIOR");
    expect(classeNaEstrategia("ETF", [{ assetClass: "RENDA_FIXA", fixedIncomeIndex: "IPCA" }])).toBe("RENDA_FIXA_IPCA");
  });

  it("ações e FIIs sem posição seguem o tipo da ficha", () => {
    expect(classeNaEstrategia("STOCK", [])).toBe("ACOES_BRASIL");
    expect(classeNaEstrategia("FII", [])).toBe("FIIS");
    expect(classeNaEstrategia("STOCK_INTL", [])).toBe("EXTERIOR");
  });
});
