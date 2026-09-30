import { describe, expect, it } from "vitest";
import { arredondaBonito, faixaDoCampo, rotuloDoAtalho } from "../faixa";

const money = ((v: number) => `R$ ${v.toLocaleString("pt-BR")}`) as Parameters<typeof rotuloDoAtalho>[2];

describe("faixa dos simuladores", () => {
  it("arredonda pra um teto bonito", () => {
    expect(arredondaBonito(1_500_000)).toBe(2_000_000);
    expect(arredondaBonito(2_200)).toBe(2_500);
    expect(arredondaBonito(0)).toBe(1);
  });

  it("dinheiro vai de zero a ~3x o exemplo, com passo redondo", () => {
    expect(faixaDoCampo({ kind: "currency" }, 500_000)).toEqual({ min: 0, max: 2_000_000, step: 10_000 });
  });

  it("percentual ao ano vai até 20% e ao mês até 3%", () => {
    expect(faixaDoCampo({ kind: "percent" }, 0.11)).toMatchObject({ min: 0, max: 0.25, step: 0.0025 });
    expect(faixaDoCampo({ kind: "percent", suffix: "a.m." }, 0.008)).toMatchObject({ max: 0.03, step: 0.0005 });
  });

  it("a página pode fixar a faixa", () => {
    expect(faixaDoCampo({ kind: "number", suffix: "meses", min: 12, max: 420, step: 12 }, 360)).toEqual({ min: 12, max: 420, step: 12 });
  });

  it("atalho de meses vira anos", () => {
    expect(rotuloDoAtalho({ kind: "number", suffix: "meses" }, 360, money)).toBe("30 anos");
    expect(rotuloDoAtalho({ kind: "number", suffix: "meses" }, 12, money)).toBe("1 ano");
    expect(rotuloDoAtalho({ kind: "number", suffix: "meses" }, 18, money)).toBe("18 meses");
    expect(rotuloDoAtalho({ kind: "percent" }, 0.105, money)).toBe("10,5%");
  });
});
