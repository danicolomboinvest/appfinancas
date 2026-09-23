import { describe, expect, it } from "vitest";
import { comboFeito, conquistas, divisao, pontosDaTemporada, sequenciaDeTemporadas } from "../game-score";

describe("pontuação do Game", () => {
  it("o combo é lançamento mais aporte no mesmo mês: os dois, ou nada", () => {
    expect(comboFeito({ registrou: true, aportou: true })).toBe(true);
    expect(comboFeito({ registrou: true, aportou: false })).toBe(false);
    expect(comboFeito({ registrou: false, aportou: true })).toBe(false);
    expect(pontosDaTemporada({ registrou: true, aportou: false, guardouBem: false, metasConcluidas: 0 })).toBe(0);
  });

  it("pontua constância, não patrimônio — e ninguém precisa registrar todo dia", () => {
    // Quem lança uma vez por mês, aporta e guarda 20% pontua o máximo da temporada.
    const umaVezPorMes = pontosDaTemporada({ registrou: true, aportou: true, guardouBem: true, metasConcluidas: 0 });
    const soMeta = pontosDaTemporada({ registrou: false, aportou: false, guardouBem: false, metasConcluidas: 1 });
    expect(umaVezPorMes).toBe(200);
    expect(soMeta).toBe(100);
  });

  it("divisão sai da soma das últimas temporadas, com numeral dentro da faixa", () => {
    expect(divisao([])).toMatchObject({ nome: "Bronze", numeral: "III", proximo: 200 });
    expect(divisao([200, 100])).toMatchObject({ nome: "Prata", numeral: "II" });
    // Seis meses só de combo param em Ouro; combo mais 20% guardado todo mês chega a Diamante.
    expect(divisao([100, 100, 100, 100, 100, 100])).toMatchObject({ nome: "Ouro", numeral: "II" });
    expect(divisao([200, 200, 200, 200, 200, 200])).toMatchObject({ nome: "Diamante", numeral: null, proximo: null, progresso: 1 });
    expect(divisao([200, 200, 200, 200, 140])).toMatchObject({ nome: "Platina", pontos: 940, numeral: "II" });
  });

  it("sequência conta meses seguidos com combo — o mês aberto ainda não zera", () => {
    expect(sequenciaDeTemporadas([true, true, true, true])).toBe(4);
    expect(sequenciaDeTemporadas([true, true, true, false])).toBe(3);
    expect(sequenciaDeTemporadas([true, false, true, true])).toBe(2);
    expect(sequenciaDeTemporadas([false, false])).toBe(0);
    expect(sequenciaDeTemporadas([])).toBe(0);
  });
});

describe("conquistas do Game", () => {
  it("cada uma é uma condição real, e a lista é sempre a mesma (travada mostra o que falta)", () => {
    const nada = conquistas({ sequencia: 0, comboNoMes: false, guardouBemNoMes: false, metasConcluidas: 0, temporadaLimpa: false, temporadasComCombo: 0 });
    expect(nada).toHaveLength(6);
    expect(nada.every((c) => !c.desbloqueada)).toBe(true);
    const tudo = conquistas({ sequencia: 6, comboNoMes: true, guardouBemNoMes: true, metasConcluidas: 1, temporadaLimpa: true, temporadasComCombo: 6 });
    expect(tudo.every((c) => c.desbloqueada)).toBe(true);
    const parcial = conquistas({ sequencia: 1, comboNoMes: true, guardouBemNoMes: false, metasConcluidas: 0, temporadaLimpa: false, temporadasComCombo: 1 });
    expect(parcial.filter((c) => c.desbloqueada).map((c) => c.chave)).toEqual(["primeiro-combo"]);
  });
});
