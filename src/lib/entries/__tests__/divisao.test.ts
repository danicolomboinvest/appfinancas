import { describe, expect, it } from "vitest";
import { aReceberPorPessoa, contaDaDivisao, contaDaSeparacao } from "../divisao";

describe("Dividir com alguém", () => {
  it("metade: as partes somam o total, até em centavo ímpar", () => {
    expect(contaDaDivisao(87.3, "metade")).toEqual({ minha: 43.65, dela: 43.65, presente: false });
    expect(contaDaDivisao(10.01, "metade")).toEqual({ minha: 5.01, dela: 5, presente: false });
  });
  it("uma parte: 30% meu, limitado entre 10% e 90%", () => {
    expect(contaDaDivisao(200, "parte", 30)).toEqual({ minha: 60, dela: 140, presente: false });
    expect(contaDaDivisao(200, "parte", 99).minha).toBe(180);
  });
  it("é de outra pessoa: vai devolver = tudo a receber; presente = tudo meu", () => {
    expect(contaDaDivisao(120, "outra", 50, true)).toEqual({ minha: 0, dela: 120, presente: false });
    expect(contaDaDivisao(120, "outra", 50, false)).toEqual({ minha: 120, dela: 0, presente: true });
  });
  it("a receber: soma por pessoa, sem o que já voltou", () => {
    expect(
      aReceberPorPessoa([
        { divididoCom: "Marina", parteDeOutro: "43.65", devolvidoEm: null },
        { divididoCom: "Marina", parteDeOutro: 10, devolvidoEm: null },
        { divididoCom: "Mãe", parteDeOutro: 100, devolvidoEm: new Date() },
        { divididoCom: "Lucas", parteDeOutro: null, devolvidoEm: null },
      ]),
    ).toEqual([{ pessoa: "Marina", valor: 53.65 }]);
  });
  it("separar: a primeira parte não passa do total", () => {
    expect(contaDaSeparacao(87.3, 65.48)).toEqual({ v1: 65.48, v2: 21.82 });
    expect(contaDaSeparacao(87.3, 200)).toEqual({ v1: 87.3, v2: 0 });
  });
});
