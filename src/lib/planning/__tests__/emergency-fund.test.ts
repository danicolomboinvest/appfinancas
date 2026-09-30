import { describe, expect, it } from "vitest";
import { mesDeConclusao } from "@/lib/planning/emergency-fund";

describe("mês em que a reserva completa", () => {
  it("dia 30 + 5 meses é fevereiro, não 2 de março", () => {
    const d = mesDeConclusao(new Date(2026, 8, 30), 5);
    expect([d.getFullYear(), d.getMonth()]).toEqual([2027, 1]);
  });

  it("dia 31 + 1 mês é o mês seguinte, não o outro", () => {
    const d = mesDeConclusao(new Date(2026, 9, 31), 1);
    expect([d.getFullYear(), d.getMonth()]).toEqual([2026, 10]);
  });

  it("vira o ano e com 0 meses fica no mês de hoje", () => {
    expect(mesDeConclusao(new Date(2026, 11, 15), 1).getFullYear()).toBe(2027);
    expect(mesDeConclusao(new Date(2026, 8, 30), 0).getMonth()).toBe(8);
  });
});
