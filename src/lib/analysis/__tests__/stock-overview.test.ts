import { describe, it, expect } from "vitest";
import { parseIndicatorNumber, buildStockOverview } from "../stock-overview";

describe("parseIndicatorNumber", () => {
  it("reads BR-formatted indicator values", () => {
    expect(parseIndicatorNumber("4,86")).toBe(4.86);
    expect(parseIndicatorNumber("26%")).toBe(26);
    expect(parseIndicatorNumber("R$ 40,59")).toBe(40.59);
    expect(parseIndicatorNumber("1.234,56")).toBe(1234.56);
    expect(parseIndicatorNumber("-0,54")).toBe(-0.54);
    expect(parseIndicatorNumber("-")).toBeNull();
    expect(parseIndicatorNumber("")).toBeNull();
  });
});

describe("buildStockOverview", () => {
  it("flags PETR4-like indicators against the general references", () => {
    const { items, counts } = buildStockOverview({
      p_l: "4,86",
      p_vp: "1,18",
      ev_ebitda: "2,76",
      dividend_yield: "6,5%",
      roe: "26%",
      roic: "8,31%",
      margem_liquida: "22%",
      divida_liquida_ebitda: "1,01",
      liquidez_corrente: "0,74",
      evolucao_receita: "12,83%",
      evolucao_lucro: "72,19%",
    });
    const by = Object.fromEntries(items.map((i) => [i.key, i.signal]));
    expect(by.p_l).toBe("favoravel"); // < 15
    expect(by.p_vp).toBe("neutro"); // entre 1 e 2,5
    expect(by.roe).toBe("favoravel"); // > 15%
    expect(by.roic).toBe("neutro"); // entre 6 e 10%
    expect(by.dividend_yield).toBe("favoravel"); // > 5%
    expect(by.divida_liquida_ebitda).toBe("favoravel"); // < 2x
    expect(by.liquidez_corrente).toBe("atencao"); // < 1
    expect(counts.favoravel).toBe(8);
    expect(counts.neutro).toBe(2);
    expect(counts.atencao).toBe(1);
  });

  it("treats negative debt as net cash (favorable) and negative P/L as attention", () => {
    const { items } = buildStockOverview({ divida_liquida_ebitda: "-0,5", p_l: "-3,2" });
    const by = Object.fromEntries(items.map((i) => [i.key, i.signal]));
    expect(by.divida_liquida_ebitda).toBe("favoravel");
    expect(by.p_l).toBe("atencao");
  });
});
