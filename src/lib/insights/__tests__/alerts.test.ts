import { describe, expect, it } from "vitest";
import { buildBudgetAlerts, buildGoalAlerts } from "../alerts";

const money = (v: number) => `R$ ${v}`;

describe("buildBudgetAlerts", () => {
  it("warns at 80% with days to go, and when it blew up, with stable keys per month", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 9,
      today: new Date(2026, 8, 17),
      planned: [
        { parentCategory: "ALIMENTACAO", planned: 800 },
        { parentCategory: "MORADIA", planned: 1500 },
        { parentCategory: "LAZER", planned: 300 },
      ],
      spent: [
        { parentCategory: "ALIMENTACAO", spent: 680 },
        { parentCategory: "MORADIA", spent: 1602 },
        { parentCategory: "LAZER", spent: 100 },
      ],
      money,
    });
    expect(alerts.map((a) => a.key)).toEqual(["2026-09:ALIMENTACAO:80", "2026-09:MORADIA:100"]);
    expect(alerts[0].title).toBe("Alimentação já usou 85%");
    expect(alerts[0].body).toBe("Faltam 13 dias e sobram R$ 120 do planejado.");
    expect(alerts[1].title).toBe("Moradia estourou");
  });

  it("does not nag about 80% when the month is almost over", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 9,
      today: new Date(2026, 8, 28),
      planned: [{ parentCategory: "ALIMENTACAO", planned: 800 }],
      spent: [{ parentCategory: "ALIMENTACAO", spent: 700 }],
      money,
    });
    expect(alerts).toEqual([]);
  });
});

describe("buildBudgetAlerts: igualdade e conta fixa pré-lançada", () => {
  it("gasto IGUAL ao planejado não é 'estourou' (o painel marca DENTRO)", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 10,
      today: new Date(2026, 9, 1),
      planned: [{ parentCategory: "MORADIA", planned: 2000 }],
      spent: [{ parentCategory: "MORADIA", spent: 2000 }],
      preCriado: [{ parentCategory: "MORADIA", spent: 2000 }],
      money,
    });
    expect(alerts).toEqual([]);
  });

  it("aluguel recorrente lançado antes do mês não dispara o aviso de 80% no dia 1", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 10,
      today: new Date(2026, 9, 1),
      planned: [{ parentCategory: "MORADIA", planned: 2000 }],
      spent: [{ parentCategory: "MORADIA", spent: 1800 }],
      preCriado: [{ parentCategory: "MORADIA", spent: 1800 }],
      money,
    });
    expect(alerts).toEqual([]);
  });

  it("o gasto do próprio mês ainda avisa aos 80% do que sobrou do plano", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 10,
      today: new Date(2026, 9, 10),
      planned: [{ parentCategory: "MORADIA", planned: 2000 }],
      // 1.800 de aluguel marcado + 170 de conserto no mês: 170/200 = 85% do que sobrava.
      spent: [{ parentCategory: "MORADIA", spent: 1970 }],
      preCriado: [{ parentCategory: "MORADIA", spent: 1800 }],
      money,
    });
    expect(alerts.map((a) => a.key)).toEqual(["2026-10:MORADIA:80"]);
    expect(alerts[0].title).toBe("Moradia já usou 99%");
  });

  it("passar do plano ainda é 'estourou', mesmo sendo conta marcada", () => {
    const alerts = buildBudgetAlerts({
      year: 2026,
      month: 10,
      today: new Date(2026, 9, 1),
      planned: [{ parentCategory: "MORADIA", planned: 2000 }],
      spent: [{ parentCategory: "MORADIA", spent: 2100 }],
      preCriado: [{ parentCategory: "MORADIA", spent: 2100 }],
      money,
    });
    expect(alerts.map((a) => a.key)).toEqual(["2026-10:MORADIA:100"]);
  });
});

describe("buildGoalAlerts", () => {
  it("only names goals that fell behind", () => {
    const alerts = buildGoalAlerts({
      year: 2026,
      month: 9,
      goals: [
        { id: "a", name: "Viagem Chile", behind: true, monthly: 766 },
        { id: "b", name: "Carro", behind: false, monthly: 500 },
      ],
      money,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: "2026-09:goal:a", title: '"Viagem Chile" ficou pra trás' });
  });
});
