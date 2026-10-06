import { describe, expect, it } from "vitest";
import { avisoDevido, chaveDoAviso, ehDoCartao, marcosAlcancados, situacaoDoLimite, type Marco } from "../limite";

describe("o que conta no limite do cartão", () => {
  it("o gasto marcado no cartão conta; o marcado fora não", () => {
    expect(ehDoCartao({ noCartao: true })).toBe(true);
    expect(ehDoCartao({ noCartao: false })).toBe(false);
  });
  it("linha de fatura sem marcação conta (as importadas antes da marcação existir)", () => {
    expect(ehDoCartao({ noCartao: null, importBatch: { docType: "fatura" } })).toBe(true);
    expect(ehDoCartao({ noCartao: null, importBatch: { docType: "extrato" } })).toBe(false);
    expect(ehDoCartao({ noCartao: null, importBatch: null })).toBe(false);
  });
  it("linha de fatura que ela marcou como fora do cartão sai da conta", () => {
    expect(ehDoCartao({ noCartao: false, importBatch: { docType: "fatura" } })).toBe(false);
  });
});

describe("situação do limite", () => {
  it("quanto falta e o nível pela parte usada", () => {
    expect(situacaoDoLimite(1840, 3000)).toMatchObject({ falta: 1160, nivel: "ok" });
    expect(situacaoDoLimite(2100, 3000).nivel).toBe("atencao");
    expect(situacaoDoLimite(2700, 3000).nivel).toBe("perto");
    expect(situacaoDoLimite(3000, 3000).nivel).toBe("passou");
  });
  it("passou: o que falta fica negativo (é quanto passou)", () => {
    expect(situacaoDoLimite(3150.5, 3000)).toMatchObject({ falta: -150.5, nivel: "passou" });
  });
  it("estorno da fatura desconta (gasto negativo)", () => {
    expect(situacaoDoLimite(-50, 3000)).toMatchObject({ falta: 3050, nivel: "ok" });
  });
});

describe("avisos em 70%, 90% e 100%, um de cada por mês", () => {
  const nada = new Set<Marco>();
  it("abaixo de 70%, nenhum aviso", () => {
    expect(marcosAlcancados(2000, 3000)).toEqual([]);
    expect(avisoDevido(2000, 3000, nada)).toBeNull();
  });
  it("chegou em 70%: avisa 70", () => {
    expect(avisoDevido(2100, 3000, nada)).toEqual({ marco: 70, marcar: [70] });
  });
  it("pulou de 60% para 95% numa compra: avisa só o 90 e marca o 70 junto", () => {
    expect(avisoDevido(2850, 3000, nada)).toEqual({ marco: 90, marcar: [70, 90] });
  });
  it("já avisou o 90 e continua em 95%: não repete", () => {
    expect(avisoDevido(2850, 3000, new Set<Marco>([70, 90]))).toBeNull();
  });
  it("passou de 100% depois do 90: avisa o 100", () => {
    expect(avisoDevido(3200, 3000, new Set<Marco>([70, 90]))).toEqual({ marco: 100, marcar: [100] });
  });
  it("sem limite (zero), nada", () => {
    expect(avisoDevido(500, 0, nada)).toBeNull();
  });
  it("a chave separa perfil, mês e marco", () => {
    expect(chaveDoAviso("p1", 2026, 3, 90)).toBe("cartao:p1:2026-03:90");
  });
});
