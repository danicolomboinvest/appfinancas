import { describe, expect, it } from "vitest";
import { splitSavings } from "../savings-split";

const RESERVA = { id: "r", name: "Reserva de emergência", kind: "reserva" as const, remaining: 18000, monthlyNeeded: 500 };
const VIAGEM = { id: "g1", name: "Viagem Chile", kind: "meta" as const, remaining: 8000, monthlyNeeded: 766 };

describe("splitSavings", () => {
  it("puts the reserve first, but leaves room for the goal in the queue", () => {
    const { slices } = splitSavings(1000, [RESERVA, VIAGEM]);
    // 60% de 1.000 = 600 > aporte combinado de 500 → a reserva leva 600, a viagem o resto.
    expect(slices).toEqual([
      { id: "r", name: "Reserva de emergência", kind: "reserva", amount: 600 },
      { id: "g1", name: "Viagem Chile", kind: "meta", amount: 400 },
    ]);
  });

  it("never lets the reserve take more than 80% while a goal is waiting", () => {
    const { slices } = splitSavings(500, [RESERVA, VIAGEM]);
    expect(slices.map((s) => [s.kind, s.amount])).toEqual([["reserva", 400], ["meta", 100]]);
  });

  it("gives the reserve everything when there is no goal, and stops at what is missing", () => {
    expect(splitSavings(500, [RESERVA]).slices).toEqual([{ id: "r", name: "Reserva de emergência", kind: "reserva", amount: 500 }]);
    const quase = splitSavings(500, [{ ...RESERVA, remaining: 120 }, VIAGEM]);
    expect(quase.slices.map((s) => [s.kind, s.amount])).toEqual([["reserva", 120], ["meta", 380]]);
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
