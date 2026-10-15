import { describe, expect, it } from "vitest";
import { buscarSeriePorPeriodo, janelas, URL_SGS_PERIODO } from "../series";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe("séries do Banco Central", () => {
  it("quebra o período em janelas de 5 anos, sem buraco nem sobreposição (a SGS recusa mais de 10)", () => {
    const j = janelas(d("2015-10-15"), d("2026-10-15"));
    expect(j.map((x) => [iso(x.de), iso(x.ate)])).toEqual([
      ["2015-10-15", "2020-10-14"],
      ["2020-10-15", "2025-10-14"],
      ["2025-10-15", "2026-10-15"],
    ]);
  });

  it("período curto é uma janela só", () => {
    expect(janelas(d("2026-10-05"), d("2026-10-15")).map((x) => [iso(x.de), iso(x.ate)])).toEqual([["2026-10-05", "2026-10-15"]]);
  });

  it("monta a URL com datas dd/mm/aaaa", () => {
    expect(URL_SGS_PERIODO(12, d("2015-10-15"), d("2020-10-14"))).toBe("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=15/10/2015&dataFinal=14/10/2020");
  });

  it("busca janela por janela, junta e tira repetidos", async () => {
    const pedidas: string[] = [];
    const pontos = await buscarSeriePorPeriodo("cdi", d("2015-10-15"), d("2026-10-15"), async (url) => {
      pedidas.push(url);
      const de = /dataInicial=([\d/]+)/.exec(url)![1];
      return [
        { data: de, valor: "0.050000" },
        { data: "02/01/2025", valor: "0.045513" },
      ];
    });
    expect(pedidas).toHaveLength(3);
    expect(pedidas.every((u) => u.includes("bcdata.sgs.12"))).toBe(true);
    expect(pontos.map((p) => iso(p.data))).toEqual(["2015-10-15", "2020-10-15", "2025-01-02", "2025-10-15"]);
  });
});
