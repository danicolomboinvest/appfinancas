import { describe, expect, it } from "vitest";
import { apertos, mesDaqui, mesesParaChegar } from "../fluxos";

describe("Como guardar mais?: onde apertar", () => {
  it("desejos primeiro, dia a dia depois, essencial e moradia nunca", () => {
    const r = apertos([
      { key: "MORADIA", label: "Moradia", planejado: 2700 },
      { key: "LAZER", label: "Lazer", planejado: 600 },
      { key: "OUTROS", label: "Compras", planejado: 950 },
      { key: "TRANSPORTE", label: "Transporte", planejado: 800 },
      { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500 },
      { key: "SAUDE", label: "Saúde", planejado: 350 },
      { key: "pet", label: "Pet", planejado: 300, essencial: true },
      { key: "bar", label: "Bar", planejado: 200 },
    ]);
    expect(r.map((a) => [a.key, a.corte, a.ligadoDeInicio])).toEqual([
      ["LAZER", 240, true],
      ["OUTROS", 238, true],
      ["bar", 50, true],
      ["ALIMENTACAO", 225, false],
      ["TRANSPORTE", 80, true],
    ]);
  });
});

describe("Quando chego na minha meta?", () => {
  it("meses guardando por mês, com e sem rendimento", () => {
    expect(mesesParaChegar({ atual: 0, alvo: 1200, taxaMensal: 0 }, 100)).toBe(12);
    expect(mesesParaChegar({ atual: 0, alvo: 1150, taxaMensal: 0.01 }, 100)).toBe(11);
    expect(mesesParaChegar({ atual: 0, alvo: 1200, taxaMensal: 0 }, 0)).toBeNull();
    expect(mesesParaChegar({ atual: 1300, alvo: 1200, taxaMensal: 0 }, 0)).toBe(0);
  });
  it("o mês por extenso e curto", () => {
    expect(mesDaqui(3, { ano: 2026, mes: 10 })).toBe("Janeiro de 2027");
    expect(mesDaqui(0, { ano: 2026, mes: 10 }, true)).toBe("out/2026");
  });
});
