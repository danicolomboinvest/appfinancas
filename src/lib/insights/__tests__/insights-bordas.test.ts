import { describe, expect, it } from "vitest";
import { buildBudgetAlerts } from "../alerts";
import { totalSpendingInsight } from "../month-insights";
import { ritmoDoMes } from "../ritmo-do-mes";

/** Bordas dos avisos e frases do mês: limites exatos, zero, negativo e a virada do ano. */
const money = (v: number) => `R$ ${v.toFixed(2)}`;

describe("totalSpendingInsight: limites exatos", () => {
  it("com exatamente 25% do mês já compara; abaixo disso, não", () => {
    expect(totalSpendingInsight(1000, 4000, 0.25)).not.toBeNull();
    expect(totalSpendingInsight(1000, 4000, 0.2499)).toBeNull();
  });

  it("base comparável de exatamente R$ 300 já vale; R$ 299,99 não", () => {
    expect(totalSpendingInsight(300, 300, 1)).not.toBeNull();
    expect(totalSpendingInsight(300, 299.99, 1)).toBeNull();
  });

  it("mês anterior zero ou negativo (só estorno) não gera porcentagem", () => {
    expect(totalSpendingInsight(500, 0)).toBeNull();
    expect(totalSpendingInsight(500, -100)).toBeNull();
  });

  it("nada gasto este mês contra um mês normal: '100% menos', sem NaN", () => {
    expect(totalSpendingInsight(0, 2000, 1)?.text).toBe("Você está gastando 100% menos que no mês passado. Continue assim.");
  });
});

describe("buildBudgetAlerts: fim de mês e virada do ano", () => {
  const planned = [{ parentCategory: "ALIMENTACAO" as const, planned: 1000 }];

  it("31 de dezembro: estouro sem 'ainda faltam 0 dias', e a chave é do mês 12", () => {
    const [a] = buildBudgetAlerts({ year: 2026, month: 12, today: new Date(2026, 11, 31), planned, spent: [{ parentCategory: "ALIMENTACAO", spent: 1200 }], money });
    expect(a.key).toBe("2026-12:ALIMENTACAO:100");
    expect(a.body).toBe("R$ 1200.00 de R$ 1000.00 planejados.");
  });

  it("plano zero não avisa nada (sem dividir por zero no percentual)", () => {
    expect(buildBudgetAlerts({ year: 2026, month: 9, today: new Date(2026, 8, 5), planned: [{ parentCategory: "ALIMENTACAO", planned: 0 }], spent: [{ parentCategory: "ALIMENTACAO", spent: 500 }], money })).toEqual([]);
  });

  it("80% exatos com 5 dias pela frente avisa; com 4 dias, não", () => {
    const spent = [{ parentCategory: "ALIMENTACAO" as const, spent: 800 }];
    expect(buildBudgetAlerts({ year: 2026, month: 9, today: new Date(2026, 8, 25), planned, spent, money })).toHaveLength(1);
    expect(buildBudgetAlerts({ year: 2026, month: 9, today: new Date(2026, 8, 26), planned, spent, money })).toHaveLength(0);
  });

  it("conta marcada que toma o plano inteiro não gera ritmo (nem divisão por zero)", () => {
    const r = buildBudgetAlerts({
      year: 2026,
      month: 9,
      today: new Date(2026, 8, 2),
      planned,
      spent: [{ parentCategory: "ALIMENTACAO", spent: 1000 }],
      preCriado: [{ parentCategory: "ALIMENTACAO", spent: 1000 }],
      money,
    });
    expect(r).toEqual([]);
  });
});

describe("ritmoDoMes: virada do ano", () => {
  it("série criada em 31/12 às 23h30 (Brasília) é conta marcada de janeiro; às 00h30 de 1/1 já é gasto do mês", () => {
    const base = { planejado: 1000, year: 2027, month: 1, today: "2027-01-10", monthElapsed: 10 / 31 };
    const antes = ritmoDoMes({ ...base, entries: [{ category: "EXPENSE", amount: 500, entryDay: "2027-01-05", createdAt: new Date("2026-12-31T23:30:00-03:00") }] });
    const depois = ritmoDoMes({ ...base, entries: [{ category: "EXPENSE", amount: 500, entryDay: "2027-01-05", createdAt: new Date("2027-01-01T00:30:00-03:00") }] });
    expect(antes?.budgetUsed).toBe(0);
    expect(depois?.budgetUsed).toBe(0.5);
  });

  it("estorno maior que os gastos do mês não deixa o uso negativo", () => {
    const r = ritmoDoMes({ planejado: 1000, year: 2026, month: 9, today: "2026-09-10", monthElapsed: 0.33, entries: [{ category: "EXPENSE", amount: -200, entryDay: "2026-09-02", createdAt: new Date("2026-09-02T15:00:00Z") }] });
    expect(r?.budgetUsed).toBe(0);
  });
});
