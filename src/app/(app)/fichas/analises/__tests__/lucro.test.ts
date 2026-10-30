import { describe, expect, it } from "vitest";
import { lucroDasLinhas } from "../montar-completa";

describe("lucro na ficha de análise", () => {
  it("não inventa lucro quando uma linha não tem valor investido", () => {
    const r = lucroDasLinhas([{ investedValue: 1000 }, { investedValue: null }], 3000);
    expect(r.diferenca).toBeNull();
  });
  it("calcula quando todas as linhas têm investido", () => {
    expect(lucroDasLinhas([{ investedValue: 1000 }, { investedValue: 500 }], 1200).diferenca).toBe(-300);
  });
  it("sem nenhuma linha investida, não mostra", () => {
    expect(lucroDasLinhas([{ investedValue: null }], 100).diferenca).toBeNull();
  });
});
