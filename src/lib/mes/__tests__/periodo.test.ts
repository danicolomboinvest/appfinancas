import { describe, expect, it } from "vitest";
import { diaDeInicioDoMes, intervaloDoMes, mesDoPeriodo } from "../periodo";

describe("mês que começa no dia da pessoa", () => {
  it("sem dia escolhido, o mês é o de sempre", () => {
    expect(mesDoPeriodo("2026-10-03", null)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-10-03", 1)).toEqual({ year: 2026, month: 10 });
  });

  it("dia 15: de 15/10 a 14/11 é outubro", () => {
    expect(mesDoPeriodo("2026-10-15", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-10-31", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-11-14", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-11-15", 15)).toEqual({ year: 2026, month: 11 });
    expect(mesDoPeriodo("2026-10-14", 15)).toEqual({ year: 2026, month: 9 });
  });

  it("vira o ano em janeiro", () => {
    expect(mesDoPeriodo("2027-01-05", 15)).toEqual({ year: 2026, month: 12 });
  });

  it("aceita a data do formulário (Date local ao meio-dia)", () => {
    expect(mesDoPeriodo(new Date(2026, 9, 3, 12), 15)).toEqual({ year: 2026, month: 9 });
  });

  it("data inválida ou vazia não vira mês", () => {
    expect(mesDoPeriodo(null, 15)).toBeNull();
    expect(mesDoPeriodo("amanhã", 15)).toBeNull();
  });

  it("só vale de 2 a 28", () => {
    expect(diaDeInicioDoMes("15")).toBe(15);
    expect(diaDeInicioDoMes(28)).toBe(28);
    for (const ruim of [0, 1, 29, 31, 1.5, "", "abc", null, undefined]) expect(diaDeInicioDoMes(ruim)).toBeNull();
  });

  it("o intervalo para a tela", () => {
    expect(intervaloDoMes(2026, 10, 15)).toBe("15/10 a 14/11");
    expect(intervaloDoMes(2026, 12, 15)).toBe("15/12 a 14/01");
    expect(intervaloDoMes(2026, 2, 28)).toBe("28/02 a 27/03");
    expect(intervaloDoMes(2026, 10, null)).toBeNull();
  });
});
