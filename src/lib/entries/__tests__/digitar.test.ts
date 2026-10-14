import { describe, expect, it } from "vitest";
import { dataDoChip, faltaParaSalvar, MAX_CENTAVOS, paraDecimal, teclar } from "../digitar";

describe("Digitar: o teclado da folha", () => {
  it("monta o valor em centavos, como numa maquininha", () => {
    let c = 0;
    for (const t of ["4", "5", "9", "0"]) c = teclar(c, t);
    expect(c).toBe(4590);
    expect(paraDecimal(c)).toBe("45.90");
    expect(teclar(c, "00")).toBe(459000);
    expect(teclar(c, "del")).toBe(459);
    expect(teclar(0, "del")).toBe(0);
    expect(teclar(MAX_CENTAVOS, "1")).toBe(MAX_CENTAVOS);
  });
  it("Hoje, Ontem e outra data", () => {
    const hoje = new Date(2026, 9, 1, 10);
    expect(dataDoChip("hoje", hoje)).toBe("2026-10-01");
    expect(dataDoChip("ontem", hoje)).toBe("2026-09-30");
    expect(dataDoChip("2026-09-15", hoje)).toBe("2026-09-15");
  });
});

describe("o que falta para salvar", () => {
  it("sem valor pede o valor primeiro", () => {
    expect(faltaParaSalvar(0, true, null)).toBe("Digite o valor no teclado antes de salvar.");
  });
  it("gasto sem categoria não vai para o servidor", () => {
    expect(faltaParaSalvar(1234, true, null)).toBe("Escolha uma categoria para o gasto.");
  });
  it("entrada não precisa de categoria", () => {
    expect(faltaParaSalvar(1234, false, null)).toBeNull();
  });
  it("gasto com categoria pode salvar", () => {
    expect(faltaParaSalvar(1234, true, "ALIMENTACAO")).toBeNull();
  });
});
