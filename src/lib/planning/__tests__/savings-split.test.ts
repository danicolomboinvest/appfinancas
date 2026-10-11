import { describe, expect, it } from "vitest";
import { mesesDeReserva, regraDosAportes, splitSavings } from "../savings-split";

const RESERVA = { id: "r", name: "Reserva de emergência", kind: "reserva" as const, remaining: 18000, monthlyNeeded: 500 };
const VIAGEM = { id: "g1", name: "Viagem Chile", kind: "meta" as const, remaining: 8000, monthlyNeeded: 766 };

describe("regra dos aportes (3.11): o dinheiro novo e a reserva", () => {
  it("menos de 3 meses: 100% para a reserva", () => {
    expect(regraDosAportes(0.6, false)).toMatchObject({ reserva: 100, sonhos: 0, faixa: "curta" });
    expect(regraDosAportes(2.99, false).reserva).toBe(100);
  });
  it("de 3 meses até a meta: 70% reserva, 30% metas", () => {
    expect(regraDosAportes(3, false)).toMatchObject({ reserva: 70, sonhos: 30, faixa: "montando" });
    expect(regraDosAportes(5.5, false).reserva).toBe(70);
  });
  it("reserva na meta: 0% reserva, 100% metas e liberdade", () => {
    expect(regraDosAportes(6, true)).toMatchObject({ reserva: 0, sonhos: 100, faixa: "completa" });
  });
  it("sem custo de vida (meses desconhecidos) conta como reserva curta", () => {
    expect(regraDosAportes(null, false).reserva).toBe(100);
    expect(mesesDeReserva(4200, 0)).toBeNull();
  });
  it("Ana: R$ 4.200 de reserva e R$ 7.100 de custo de vida dão 0,6 mês, então 100% vai para a reserva", () => {
    const meses = mesesDeReserva(4200, 7100)!;
    expect(meses).toBeCloseTo(0.59, 2);
    expect(regraDosAportes(meses, false).reserva).toBe(100);
  });
});

describe("splitSavings", () => {
  it("reserva curta (menos de 3 meses) leva todo o dinheiro novo, mesmo com meta na fila", () => {
    const { slices } = splitSavings(900, [{ ...RESERVA, monthsCovered: 0.6 }, VIAGEM]);
    expect(slices).toEqual([{ id: "r", name: "Reserva de emergência", kind: "reserva", amount: 900 }]);
  });

  it("reserva montando (3 meses ou mais) leva 70% e a meta 30%", () => {
    const { slices } = splitSavings(1000, [{ ...RESERVA, monthsCovered: 3.4 }, VIAGEM]);
    expect(slices.map((s) => [s.kind, s.amount])).toEqual([["reserva", 700], ["meta", 300]]);
  });

  it("o que a meta não usa dos 30% volta para a reserva que ainda não está pronta", () => {
    const { slices } = splitSavings(1000, [{ ...RESERVA, monthsCovered: 4 }, { ...VIAGEM, monthlyNeeded: 100 }]);
    expect(slices.map((s) => [s.kind, s.amount])).toEqual([["reserva", 900], ["meta", 100]]);
  });

  it("reserva curta que completa no meio do caminho: o resto segue para as metas", () => {
    const quase = splitSavings(500, [{ ...RESERVA, remaining: 120, monthsCovered: 2.9 }, VIAGEM]);
    expect(quase.slices.map((s) => [s.kind, s.amount])).toEqual([["reserva", 120], ["meta", 380]]);
  });

  it("sem meta, a reserva montando leva tudo (até o que falta)", () => {
    expect(splitSavings(500, [{ ...RESERVA, monthsCovered: 4 }]).slices).toEqual([{ id: "r", name: "Reserva de emergência", kind: "reserva", amount: 500 }]);
  });

  it("reserva completa (nada faltando) não recebe nada: tudo para metas e liberdade", () => {
    const r = splitSavings(1000, [{ ...RESERVA, remaining: 0, monthsCovered: 6 }, VIAGEM]);
    expect(r.slices.map((s) => [s.kind, s.amount])).toEqual([["meta", 766], ["livre", 234]]);
  });

  it("caps a goal at what it needs per month and sends the rest to freedom", () => {
    const { slices, leftover } = splitSavings(2000, [{ ...VIAGEM, monthlyNeeded: 766 }]);
    expect(slices).toEqual([
      { id: "g1", name: "Viagem Chile", kind: "meta", amount: 766 },
      { id: "livre", name: "Liberdade financeira", kind: "livre", amount: 1234 },
    ]);
    expect(leftover).toBe(1234);
    expect(splitSavings(0, [RESERVA]).slices).toEqual([]);
  });
});
