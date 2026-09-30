import { describe, expect, it } from "vitest";
import { APORTES_SOMAM_DESDE, aportesJaOcorridosWhere, goalCurrentAmount, goalProgress } from "@/lib/planning/goal-progress";

// Aporte de antes da correção do formulário (o "Já guardado" pode já contê-lo) e de depois.
const ANTIGO = new Date("2026-09-20T12:00:00.000Z");
const NOVO = new Date("2026-10-05T12:00:00.000Z");
const aporte = (amount: number, createdAt: Date, allocations: { amount: number; assetGoalId: string | null }[] = []) => ({ amount, createdAt, allocations });

describe("Já guardado digitado + o que o app enxerga", () => {
  it("o corte fica depois do deploy da correção do formulário (28/09, noite)", () => {
    expect(ANTIGO < APORTES_SOMAM_DESDE && NOVO > APORTES_SOMAM_DESDE).toBe(true);
    expect(APORTES_SOMAM_DESDE.toISOString()).toBe("2026-09-29T00:00:00.000Z");
  });

  it("aporte marcado depois do Já guardado soma em cima dele", () => {
    // Digitou R$ 5.000 em "Já guardado" e depois marcou o aporte de R$ 1.396.
    expect(goalCurrentAmount("apê", 5000, 0, [aporte(1396, NOVO)])).toBe(6396);
  });

  it("R$ 500 por mês com R$ 5.000 de partida: a meta anda todo mês (não fica parada até o 10º)", () => {
    const seis = Array.from({ length: 6 }, () => aporte(500, NOVO));
    expect(goalCurrentAmount("viagem", 5000, 0, seis)).toBe(8000);
  });

  it("aporte antigo não soma: o formulário antigo já tinha gravado o total no Já guardado", () => {
    // Formulário antigo salvou 6.000 = CDB de 5.000 + aporte de 1.000.
    expect(goalCurrentAmount("apê", 6000, 5000, [aporte(1000, ANTIGO)])).toBe(6000);
    // E um aporte novo depois disso soma só ele.
    expect(goalCurrentAmount("apê", 6000, 5000, [aporte(1000, ANTIGO), aporte(500, NOVO)])).toBe(6500);
  });

  it("ligar o CDB que já era o Já guardado não conta em dobro, nem com aporte novo entrando nele", () => {
    expect(goalCurrentAmount("apê", 5000, 5000, [])).toBe(5000);
    // Aporte de R$ 1.000 que entrou nesse mesmo CDB: o CDB passa a valer 6.000.
    expect(goalCurrentAmount("apê", 5000, 6000, [aporte(1000, NOVO, [{ amount: 1000, assetGoalId: "apê" }])])).toBe(6000);
  });

  it("aporte novo num investimento novo da meta também soma em cima do Já guardado", () => {
    expect(goalCurrentAmount("apê", 5000, 1000, [aporte(1000, NOVO, [{ amount: 1000, assetGoalId: "apê" }])])).toBe(6000);
  });

  it("sem nada vinculado, vale só o digitado (metas antigas não zeram)", () => {
    expect(goalCurrentAmount("apê", 5000, 0, [])).toBe(5000);
  });

  it("sem saldo de partida, vale só o calculado", () => {
    expect(goalCurrentAmount("apê", 0, 2000, [aporte(300, NOVO)])).toBe(2300);
    expect(goalCurrentAmount("apê", 0, 2000, [aporte(300, NOVO)])).toBe(goalProgress("apê", 2000, [aporte(300, NOVO)]));
  });

  it("quando o vinculado passa do digitado, vale o vinculado", () => {
    expect(goalCurrentAmount("apê", 5000, 7200, [])).toBe(7200);
  });

  it("arredonda nos centavos", () => {
    expect(goalCurrentAmount("apê", 0.1, 0, [aporte(0.104, NOVO)])).toBe(0.2);
  });
});

describe("aporte só conta na meta quando o mês dele já começou", () => {
  // Filtro aplicado em memória, igual ao que o banco faria com o where.
  const passa = (where: ReturnType<typeof aportesJaOcorridosWhere>, e: { year: number; month: number }) =>
    where.OR.some((c) =>
      typeof c.year === "number" ? e.year === c.year && e.month <= (c.month?.lte ?? 0) : e.year < c.year.lt,
    );

  it("aporte repetido de setembro a dezembro conta só setembro em setembro", () => {
    const where = aportesJaOcorridosWhere(new Date(2026, 8, 28));
    const copias = [9, 10, 11, 12].map((month) => ({ year: 2026, month, amount: 500 }));
    const contam = copias.filter((e) => passa(where, e));
    expect(contam.map((e) => e.month)).toEqual([9]);
    expect(goalProgress("viagem", 0, contam.map((e) => ({ amount: e.amount, allocations: [] })))).toBe(500);
  });

  it("anos anteriores contam inteiros; o ano que vem não conta", () => {
    const where = aportesJaOcorridosWhere(new Date(2026, 0, 1));
    expect(passa(where, { year: 2025, month: 12 })).toBe(true);
    expect(passa(where, { year: 2026, month: 1 })).toBe(true);
    expect(passa(where, { year: 2026, month: 2 })).toBe(false);
    expect(passa(where, { year: 2027, month: 1 })).toBe(false);
  });
});
