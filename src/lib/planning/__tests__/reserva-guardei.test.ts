import { describe, expect, it } from "vitest";
import { chaveDoMesDaReserva, mesesAteCompletar, mostraGuardei, valorDoGuardei } from "../reserva-guardei";

const RESERVA = { targetAmount: 18_000, currentAmount: 4_000, monthlyContribution: 300 };

describe("valorDoGuardei", () => {
  it("sem valor digitado, lança o combinado por mês da reserva", () => {
    expect(valorDoGuardei(RESERVA)).toBe(300);
  });

  it("com 'outro valor', vale o que ela digitou", () => {
    expect(valorDoGuardei(RESERVA, 125.5)).toBe(125.5);
  });

  it("não corta no que falta: o que ela guardou é o que ela guardou", () => {
    expect(valorDoGuardei({ ...RESERVA, currentAmount: 17_900 })).toBe(300);
  });

  it("arredonda pros centavos (dízima de conta não vira lançamento torto)", () => {
    expect(valorDoGuardei(RESERVA, 100.005)).toBe(100.01);
    expect(valorDoGuardei({ ...RESERVA, monthlyContribution: 333.3333 })).toBe(333.33);
  });

  it("nada a lançar com combinado zerado, valor menor que R$ 1 ou inválido", () => {
    expect(valorDoGuardei({ ...RESERVA, monthlyContribution: 0 })).toBeNull();
    expect(valorDoGuardei(RESERVA, 0.5)).toBeNull();
    expect(valorDoGuardei(RESERVA, -50)).toBeNull();
    expect(valorDoGuardei(RESERVA, Number.NaN)).toBeNull();
    expect(valorDoGuardei(RESERVA, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("mostraGuardei", () => {
  it("aparece com reserva montada, combinado por mês e reserva incompleta", () => {
    expect(mostraGuardei(RESERVA)).toBe(true);
  });

  it("não aparece sem reserva montada", () => {
    expect(mostraGuardei(null)).toBe(false);
  });

  it("não aparece com a reserva completa (ou passando da meta)", () => {
    expect(mostraGuardei({ ...RESERVA, currentAmount: 18_000 })).toBe(false);
    expect(mostraGuardei({ ...RESERVA, currentAmount: 20_000 })).toBe(false);
  });

  it("não aparece sem valor por mês combinado", () => {
    expect(mostraGuardei({ ...RESERVA, monthlyContribution: 0 })).toBe(false);
  });
});

describe("chaveDoMesDaReserva", () => {
  it("usa o mês do relógio que recebeu, com dois dígitos", () => {
    expect(chaveDoMesDaReserva(new Date(2026, 8, 30, 23, 30))).toBe("2026-09");
    expect(chaveDoMesDaReserva(new Date(2026, 11, 1))).toBe("2026-12");
  });
});

describe("mesesAteCompletar", () => {
  it("1 mês no singular (antes aparecia '1 meses')", () => {
    expect(mesesAteCompletar(1)).toEqual({ tipo: "meses", texto: "1 mês" });
  });

  it("plural a partir de 2", () => {
    expect(mesesAteCompletar(9)).toEqual({ tipo: "meses", texto: "9 meses" });
  });

  it("zero é reserva pronta (antes aparecia '0 meses')", () => {
    expect(mesesAteCompletar(0)).toEqual({ tipo: "pronta" });
  });

  it("null é 'não fecha'", () => {
    expect(mesesAteCompletar(null)).toEqual({ tipo: "naoFecha" });
  });
});
