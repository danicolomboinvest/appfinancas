import { describe, expect, it } from "vitest";
import { ritmoDoMes, type EntradaDoRitmo } from "../ritmo-do-mes";

// Outubro/2026, hoje dia 3 (10% do mês).
const base = { year: 2026, month: 10, today: "2026-10-03", monthElapsed: 3 / 31 };
const antesDoMes = new Date("2026-01-15T15:00:00Z");
const noMes = new Date("2026-10-02T15:00:00Z");

function gasto(amount: number, entryDay: string | null, createdAt: Date): EntradaDoRitmo {
  return { category: "EXPENSE", amount, entryDay, createdAt };
}

describe("ritmoDoMes", () => {
  it("não acusa ritmo rápido pelas contas fixas lançadas antes do mês (recorrência)", () => {
    const r = ritmoDoMes({
      ...base,
      planejado: 5000,
      entries: [gasto(2000, "2026-10-05", antesDoMes), gasto(500, "2026-10-01", antesDoMes), gasto(100, "2026-10-02", noMes)],
    });
    // Plano variável = 5000 − 2500; gasto variável até hoje = 100 → 4%, abaixo dos 10% do mês.
    expect(r?.budgetUsed).toBeCloseTo(100 / 2500, 6);
    expect(r!.budgetUsed).toBeLessThan(base.monthElapsed);
  });

  it("não conta o boleto datado pra frente, mas conta o que está sem data (fatura)", () => {
    const r = ritmoDoMes({
      ...base,
      planejado: 1000,
      entries: [gasto(300, "2026-10-25", noMes), gasto(50, null, noMes), gasto(20, "2026-10-03", noMes)],
    });
    expect(r?.budgetUsed).toBeCloseTo(70 / 1000, 6);
  });

  it("ignora renda e aporte", () => {
    const r = ritmoDoMes({
      ...base,
      planejado: 1000,
      entries: [
        { category: "INCOME", amount: 5000, entryDay: "2026-10-01", createdAt: noMes },
        { category: "INVESTMENT_CONTRIBUTION", amount: 500, entryDay: "2026-10-01", createdAt: noMes },
      ],
    });
    expect(r?.budgetUsed).toBe(0);
  });

  it("série criada no último dia do mês anterior às 22h (Brasília) conta como marcada", () => {
    // 01:00 UTC do dia 1 = 22h do dia 30/09 em Brasília.
    const r = ritmoDoMes({ ...base, planejado: 1000, entries: [gasto(400, "2026-10-01", new Date("2026-10-01T01:00:00Z"))] });
    expect(r?.budgetUsed).toBe(0);
  });

  it("sem orçamento, ou com o orçamento inteiro já em contas marcadas, não há ritmo pra medir", () => {
    expect(ritmoDoMes({ ...base, planejado: 0, entries: [] })).toBeNull();
    expect(ritmoDoMes({ ...base, planejado: 1000, entries: [gasto(1000, "2026-10-05", antesDoMes)] })).toBeNull();
  });
});
