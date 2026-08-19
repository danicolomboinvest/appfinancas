import { describe, expect, it } from "vitest";
import { classifyDividendTax, netValuePerShare } from "../dividend-tax";

describe("classifyDividendTax", () => {
  it("JSCP é sempre tributado a 15% (regra sem exceção)", () => {
    expect(classifyDividendTax("JSCP")).toBe("jscp_15");
    expect(classifyDividendTax("jscp")).toBe("jscp_15"); // case-insensitive
    expect(classifyDividendTax("Juros sobre Capital Próprio")).toBe("jscp_15");
  });

  it("Dividendos (ações) e Rendimentos (FII) são isentos", () => {
    expect(classifyDividendTax("Dividendos")).toBe("isento");
    expect(classifyDividendTax("Rendimento")).toBe("isento");
  });

  it("Rend. Trib. (rendimento tributável) fica como desconhecido — não inventa alíquota", () => {
    expect(classifyDividendTax("Rend. Trib.")).toBe("desconhecido");
  });

  it("rótulo não mapeado (o site pode mudar o texto) também fica desconhecido, nunca quebra", () => {
    expect(classifyDividendTax("Bonificação em Ações")).toBe("desconhecido");
    expect(classifyDividendTax("")).toBe("desconhecido");
  });
});

describe("netValuePerShare", () => {
  it("desconta 15% só do JSCP", () => {
    expect(netValuePerShare("JSCP", 1)).toBeCloseTo(0.85, 10);
    expect(netValuePerShare("JSCP", 0.20250435)).toBeCloseTo(0.172128, 5);
  });

  it("isento e desconhecido mantêm o valor bruto (não desconta o que não deveria)", () => {
    expect(netValuePerShare("Dividendos", 1)).toBe(1);
    expect(netValuePerShare("Rendimento", 0.1)).toBe(0.1);
    expect(netValuePerShare("Rend. Trib.", 0.5)).toBe(0.5);
  });
});
