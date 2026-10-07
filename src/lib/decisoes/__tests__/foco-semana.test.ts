import { describe, expect, it } from "vitest";
import { diaDaSemana, previsaoDoMes, ritmoDoMes, livreAteDomingo } from "../foco-semana";
import { ritmoVariavel } from "../foco";

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

describe("ritmo sem as contas fixas (05/10/2026)", () => {
  // Dia 5 de 31: o aluguel e o plano já saíram, o resto do mês mal começou.
  const categorias = [
    { gasto: 2370, planejado: 2400, fixa: true },
    { gasto: 389, planejado: 400, fixa: false, fixoAutomatico: 389 },
    { gasto: 150, planejado: 1500, fixa: false },
    { gasto: 60, planejado: 600, fixa: false },
  ];
  const decorrido = 4 / 31;

  it("aluguel pago no dia 1 não faz o mês parecer \"gastando rápido demais\"", () => {
    const total = categorias.reduce((s, c) => s + c.gasto, 0) / categorias.reduce((s, c) => s + c.planejado, 0);
    expect(ritmoDoMes(total, decorrido)).toBe("rapido"); // a régua antiga: o falso alarme
    const v = ritmoVariavel(categorias, 0);
    expect(v.planoVariavel).toBe(2111);
    expect(v.gastoVariavel).toBe(210);
    expect(ritmoDoMes(v.gastoVariavel / v.planoVariavel, decorrido)).toBe("dentro");
  });

  it("a previsão não multiplica o aluguel pelos dias que faltam", () => {
    const v = ritmoVariavel(categorias, 0);
    // Régua antiga: 4.900 menos 2.969 projetados pro mês inteiro, um estouro de quase R$ 5 mil.
    expect(previsaoDoMes(4900, 2969, 0.3)).toBeLessThan(-4000);
    expect(previsaoDoMes(v.planoVariavel, v.gastoVariavel, 0.3)).toBe(1411);
  });

  it("conta fixa só volta como o que passou do planejado; gasto fora do orçamento corre", () => {
    const v = ritmoVariavel([{ gasto: 2600, planejado: 2400, fixa: true }, { gasto: 100, planejado: 1000, fixa: false }], 50);
    expect(v.gastoVariavel).toBe(350);
    expect(v.planoVariavel).toBe(1000);
  });
});

describe("livre até domingo, pelo orçamento (07/10/2026)", () => {
  it("numa quarta, com 25 dias no mês: R$ 130 por dia, 5 dias até domingo = R$ 650", () => {
    const semana = livreAteDomingo(3250, 25, 5);
    expect(semana).toBe(650);
    // O por dia do Foco (semana ÷ dias até domingo) é o mesmo do Orçamento (sobra ÷ dias do mês).
    expect(semana / 5).toBe(3250 / 25);
  });
  it("na segunda, a semana inteira", () => {
    expect(livreAteDomingo(3000, 30, 7)).toBe(700);
  });
  it("no fim do mês, com menos dias que até domingo, é o que sobra inteiro", () => {
    expect(livreAteDomingo(400, 3, 6)).toBe(400);
  });
  it("sem o dia da semana, conta 7 dias", () => {
    expect(livreAteDomingo(3000, 30)).toBe(700);
  });
});
