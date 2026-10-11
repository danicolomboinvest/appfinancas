import { describe, expect, it } from "vitest";
import { pesoInteiro, resumirCarteira, type AtivoDoResumo } from "../resumo-carteira";

/** A carteira da Ana canônica (ana-canonica.md, item 5). */
const a = (id: string, assetClass: AtivoDoResumo["assetClass"], currentValue: number, investedValue: number, extra: Partial<AtivoDoResumo> = {}): AtivoDoResumo => ({
  id, assetClass, fixedIncomeIndex: null, currency: "BRL", currentValue, investedValue, nativeCurrentValue: null, exchangeRate: null, ...extra,
});
const ANA: AtivoDoResumo[] = [
  a("selic", "TESOURO_DIRETO", 4200, 4100, { fixedIncomeIndex: "POS_FIXADO" }),
  a("ipca", "TESOURO_DIRETO", 6180, 6000, { fixedIncomeIndex: "IPCA" }),
  a("caixinha", "RENDA_FIXA", 1429, 1400, { fixedIncomeIndex: "POS_FIXADO" }),
  a("cdb", "RENDA_FIXA", 8300, 8000, { fixedIncomeIndex: "POS_FIXADO" }),
  a("mxrf", "FII", 4810, 5025),
  a("hglg", "FII", 3168, 3300),
  a("bbas", "ACAO", 2892, 3300),
  a("itsa", "ACAO", 3940, 4080),
  a("ivvb", "INTERNACIONAL", 5280, 4950),
  a("voo", "INTERNACIONAL", 1370.51, 1300, { currency: "USD", nativeCurrentValue: 251.47, exchangeRate: 5.45 }),
];

describe("Meus ativos: os números da Ana", () => {
  const r = resumirCarteira(ANA);
  it("total R$ 41.569,51, ganho de R$ 114,51 (0,3%)", () => {
    expect(r.total).toBe(41569.51);
    expect(r.ganho).toBe(114.51);
    expect((r.ganhoPct! * 100).toFixed(1)).toBe("0.3");
  });
  it("Brasil R$ 40.199 + Exterior US$ 251,47 ≈ R$ 1.371 (dólar R$ 5,45)", () => {
    expect(r.brasil).toBe(40199);
    expect(r.exterior).toBe(1370.51);
    expect(r.exteriorEmDolar).toBe(251.47);
    expect(r.cambio).toBe(5.45);
    expect(r.brasil + r.exterior).toBeCloseTo(r.total, 2);
  });
  it("Por tipo: Tesouro 25%, Renda fixa 23%, FIIs 19%, Ações 16%, Exterior 16% (1 em dólar, 1 na B3)", () => {
    expect(r.grupos.map((g) => [g.nome, Math.round(g.valor), pesoInteiro(g.peso)])).toEqual([
      ["Tesouro", 10380, "25%"],
      ["Renda fixa", 9729, "23%"],
      ["FIIs", 7978, "19%"],
      ["Ações", 6832, "16%"],
      ["Exterior", 6651, "16%"],
    ]);
    const ext = r.grupos.find((g) => g.grupo === "exterior")!;
    expect([ext.emDolar, ext.naB3]).toEqual([1, 1]);
  });
  it("trocar o CDB para 'Exterior' leva o valor para o Exterior no herói e no Por tipo", () => {
    const t = resumirCarteira(ANA.map((x) => (x.id === "cdb" ? { ...x, ondeEscolhido: "exterior" } : x)));
    expect(t.brasil).toBe(31899);
    expect(t.exterior).toBe(9670.51);
    expect(t.exteriorEmDolar).toBe(Math.round((251.47 + 8300 / 5.45) * 100) / 100);
    expect(t.grupos.find((g) => g.grupo === "exterior")!.valor).toBe(14950.51);
  });
  it("carteira vazia: sem ganho e sem exterior", () => {
    expect(resumirCarteira([])).toMatchObject({ total: 0, ganho: null, exteriorEmDolar: null, grupos: [] });
  });
});
