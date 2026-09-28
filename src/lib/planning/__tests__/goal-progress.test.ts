import { describe, expect, it } from "vitest";
import { aportesJaOcorridosWhere, goalCurrentAmount, goalProgress } from "@/lib/planning/goal-progress";

describe("Já guardado digitado + o que o app enxerga", () => {
  it("o primeiro aporte não apaga o saldo de partida", () => {
    // Digitou R$ 5.000 em "Já guardado" e depois marcou o aporte de R$ 1.396.
    const progresso = goalProgress("apê", 0, [{ amount: 1396, allocations: [] }]);
    expect(goalCurrentAmount(5000, progresso)).toBe(5000);
  });

  it("sem nada vinculado, vale só o digitado (metas antigas não zeram)", () => {
    expect(goalCurrentAmount(5000, goalProgress("apê", 0, []))).toBe(5000);
  });

  it("sem saldo de partida, vale só o calculado", () => {
    expect(goalCurrentAmount(0, goalProgress("apê", 2000, [{ amount: 300, allocations: [] }]))).toBe(2300);
  });

  it("digitado igual ao vinculado (formulário antigo salvava o total) não conta em dobro", () => {
    expect(goalCurrentAmount(6000, 6000)).toBe(6000);
    expect(goalCurrentAmount(5000, 7200)).toBe(7200);
  });

  it("arredonda nos centavos", () => {
    expect(goalCurrentAmount(0.1, 0.204)).toBe(0.2);
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
