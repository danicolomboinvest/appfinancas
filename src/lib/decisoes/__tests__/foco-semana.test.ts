import { describe, expect, it } from "vitest";
import { diaDaSemana, previsaoDoMes, ritmoDoMes } from "../foco-semana";

describe("cartão da semana na Foco", () => {
  it("ritmo: a mesma régua da Visão mensal", () => {
    expect(ritmoDoMes(0.4, 0.5)).toBe("dentro");
    expect(ritmoDoMes(0.53, 0.5)).toBe("limite");
    expect(ritmoDoMes(0.7, 0.5)).toBe("rapido");
  });
  it("previsão: orçamento menos o gasto projetado para o mês inteiro", () => {
    expect(previsaoDoMes(5000, 2000, 0.5)).toBe(1000);
    expect(previsaoDoMes(5000, 3000, 0.5)).toBe(-1000);
  });
  it("no comecinho do mês a média ainda mente: sem previsão", () => {
    expect(previsaoDoMes(5000, 900, 0.1)).toBeNull();
  });
  it("semana começa na segunda; domingo é o último dia", () => {
    expect(diaDaSemana(new Date(2026, 9, 1))).toEqual({ indice: 3, diasAteDomingo: 4 }); // quinta
    expect(diaDaSemana(new Date(2026, 9, 4))).toEqual({ indice: 6, diasAteDomingo: 1 }); // domingo
  });
});
