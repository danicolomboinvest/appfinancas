import { describe, expect, it } from "vitest";
import { estimarRendaFixa, mesesDesde, textoDoRendimento } from "../estimativa-renda-fixa";

describe("estimativa da renda fixa (Novo ativo)", () => {
  it("100% do CDI por 12 meses rende o CDI do ano", () => {
    expect(estimarRendaFixa({ investido: 1000, meses: 12, rende: { indexador: "cdi", percentual: 100 }, cdiAoAno: 0.1365, ipca12m: null })).toBe(1136.5);
  });
  it("105% do CDI rende mais que 100%", () => {
    const a = estimarRendaFixa({ investido: 8000, meses: 6, rende: { indexador: "cdi", percentual: 105 }, cdiAoAno: 0.1365, ipca12m: null })!;
    const b = estimarRendaFixa({ investido: 8000, meses: 6, rende: { indexador: "cdi", percentual: 100 }, cdiAoAno: 0.1365, ipca12m: null })!;
    expect(a).toBeGreaterThan(b);
  });
  it("IPCA + 6% e prefixado de 12% ao ano", () => {
    expect(estimarRendaFixa({ investido: 1000, meses: 12, rende: { indexador: "ipca", taxa: 6 }, cdiAoAno: null, ipca12m: 0.045 })).toBe(1107.7);
    expect(estimarRendaFixa({ investido: 1000, meses: 24, rende: { indexador: "pre", taxa: 12 }, cdiAoAno: null, ipca12m: null })).toBe(1254.4);
  });
  it("sem o índice do Banco Central, não estima (a tela pergunta o valor)", () => {
    expect(estimarRendaFixa({ investido: 1000, meses: 12, rende: { indexador: "cdi", percentual: 100 }, cdiAoAno: null, ipca12m: null })).toBeNull();
    expect(estimarRendaFixa({ investido: 0, meses: 12, rende: { indexador: "pre", taxa: 10 }, cdiAoAno: null, ipca12m: null })).toBeNull();
  });
  it("meses desde a compra e o texto do rendimento", () => {
    expect(mesesDesde(2025, 10, new Date(2026, 9, 11))).toBe(12);
    expect(mesesDesde(2027, 1, new Date(2026, 9, 11))).toBe(0);
    expect(textoDoRendimento({ indexador: "cdi", percentual: 105 })).toBe("105% do CDI");
    expect(textoDoRendimento({ indexador: "ipca", taxa: 7.5 })).toBe("IPCA + 7,5%");
  });
});
