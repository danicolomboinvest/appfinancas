import { describe, expect, it } from "vitest";
import { splitSavings, type SavingsTarget } from "../savings-split";

/** Bordas do "pra onde vai o que você guarda": zero, negativo, centavos e fila vazia. */
const reserva = (o: Partial<SavingsTarget> = {}): SavingsTarget => ({ id: "reserva", name: "Reserva", kind: "reserva", remaining: 10000, monthlyNeeded: 500, ...o });
const meta = (o: Partial<SavingsTarget> = {}): SavingsTarget => ({ id: "m1", name: "Viagem", kind: "meta", remaining: 3000, monthlyNeeded: 300, ...o });
const soma = (s: { amount: number }[]) => Math.round(s.reduce((t, x) => t + x.amount, 0) * 100) / 100;

describe("splitSavings: bordas", () => {
  it("zero ou negativo não reparte nada", () => {
    expect(splitSavings(0, [reserva(), meta()])).toEqual({ slices: [], leftover: 0 });
    expect(splitSavings(-100, [reserva(), meta()])).toEqual({ slices: [], leftover: 0 });
  });

  it("sem reserva e sem meta: tudo vai pra liberdade financeira", () => {
    expect(splitSavings(250, [])).toEqual({ slices: [{ id: "livre", name: "Liberdade financeira", kind: "livre", amount: 250 }], leftover: 250 });
  });

  it("reserva e meta já completas (remaining 0) não recebem nada", () => {
    const r = splitSavings(100, [reserva({ remaining: 0 }), meta({ remaining: 0 })]);
    expect(r.slices.map((s) => s.kind)).toEqual(["livre"]);
  });

  it("as fatias somam o valor guardado, ao centavo, mesmo com valores quebrados", () => {
    for (const valor of [99.99, 100.01, 333.33, 0.01, 1234.567]) {
      const r = splitSavings(valor, [reserva({ monthlyNeeded: 10 }), meta({ monthlyNeeded: 33.337 }), meta({ id: "m2", monthlyNeeded: 0 })]);
      expect(soma(r.slices)).toBe(Math.round(valor * 100) / 100);
      for (const s of r.slices) expect(Math.round(s.amount * 100) / 100).toBe(s.amount);
    }
  });

  it("meta sem valor mensal (0) leva o que sobrou, até o que falta pra ela", () => {
    const r = splitSavings(1000, [meta({ monthlyNeeded: 0, remaining: 400 })]);
    expect(r.slices).toEqual([
      { id: "m1", name: "Viagem", kind: "meta", amount: 400 },
      { id: "livre", name: "Liberdade financeira", kind: "livre", amount: 600 },
    ]);
  });

  // Arredondamento: um valor menor que meio centavo não pode virar uma fatia "R$ 0,004".
  it("valor abaixo de 1 centavo não vira fatia de fração de centavo", () => {
    const r = splitSavings(0.004, []);
    for (const s of r.slices) expect(Math.round(s.amount * 100) / 100).toBe(s.amount);
  });
});
