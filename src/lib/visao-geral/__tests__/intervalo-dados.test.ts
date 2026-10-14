import { describe, expect, it } from "vitest";
import { dentroDoIntervalo, mesesDoIntervalo, somaDoIntervalo } from "../intervalo-dados";
import type { Intervalo } from "../periodo";

const i7: Intervalo = { tipo: "7d", de: { ano: 2026, mes: 10, dia: 5 }, ate: { ano: 2026, mes: 10, dia: 11 } };
const tri: Intervalo = { tipo: "tri-ant", de: { ano: 2026, mes: 7, dia: 1 }, ate: { ano: 2026, mes: 9, dia: 30 } };
const virada: Intervalo = { tipo: "custom", de: { ano: 2025, mes: 12, dia: 20 }, ate: { ano: 2026, mes: 1, dia: 10 } };

describe("o que entra num período que não é mês", () => {
  it("os meses tocados, inclusive na virada do ano", () => {
    expect(mesesDoIntervalo(tri)).toEqual([{ year: 2026, month: 7 }, { year: 2026, month: 8 }, { year: 2026, month: 9 }]);
    expect(mesesDoIntervalo(virada)).toEqual([{ year: 2025, month: 12 }, { year: 2026, month: 1 }]);
  });
  it("com dia: só se o dia está dentro (pontas incluídas)", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(dentroDoIntervalo({ year: 2026, month: 10, entryDate: d("2026-10-05") }, i7)).toBe(true);
    expect(dentroDoIntervalo({ year: 2026, month: 10, entryDate: d("2026-10-11") }, i7)).toBe(true);
    expect(dentroDoIntervalo({ year: 2026, month: 10, entryDate: d("2026-10-04") }, i7)).toBe(false);
  });
  it("sem dia: só quando o mês inteiro cabe no período", () => {
    expect(dentroDoIntervalo({ year: 2026, month: 10, entryDate: null }, i7)).toBe(false);
    expect(dentroDoIntervalo({ year: 2026, month: 8, entryDate: null }, tri)).toBe(true);
  });
  it("soma igual à do mês: sobra = entrou - gastou - guardou", () => {
    expect(
      somaDoIntervalo([
        { category: "INCOME", amount: "5000" },
        { category: "EXPENSE", amount: 1200.1 },
        { category: "INVESTMENT_CONTRIBUTION", amount: 300 },
      ]),
    ).toEqual({ totalIncome: 5000, totalExpense: 1200.1, totalInvestment: 300, balance: 3499.9 });
  });
});

import { gastoPorCategoria, planoDoIntervalo } from "../intervalo-dados";

describe("Orçamento de um período", () => {
  it("só gastos, por categoria, do maior pro menor", () => {
    expect(
      gastoPorCategoria([
        { category: "EXPENSE", amount: 50, parentCategory: "LAZER", customCategoryId: null },
        { category: "EXPENSE", amount: 80, parentCategory: "ALIMENTACAO", customCategoryId: null },
        { category: "EXPENSE", amount: 40, parentCategory: "LAZER", customCategoryId: null },
        { category: "EXPENSE", amount: 10, parentCategory: "LAZER", customCategoryId: "pet" },
        { category: "INCOME", amount: 5000, parentCategory: null, customCategoryId: null },
      ]),
    ).toEqual([
      { key: "LAZER", gasto: 90 },
      { key: "ALIMENTACAO", gasto: 80 },
      { key: "pet", gasto: 10 },
    ]);
  });
  it("meses inteiros: soma plano e gasto de cada mês, atravessando o ano", () => {
    const r = planoDoIntervalo(
      [
        { year: 2025, months: [{ month: 12, categories: [{ categoryKey: "LAZER", planned: 600, spent: 700 }] }] },
        { year: 2026, months: [{ month: 1, categories: [{ categoryKey: "LAZER", planned: 600, spent: 400 }, { categoryKey: "SAUDE", planned: 0, spent: 0 }] }] },
      ],
      [{ year: 2025, month: 12 }, { year: 2026, month: 1 }],
    );
    expect(r).toEqual({ categorias: [{ key: "LAZER", planejado: 1200, gasto: 1100 }], planejado: 1200, gasto: 1100, semPlano: [], mesesComPlano: 2 });
  });
  it("mês sem plano não é cobrado do plano: o gasto dele fica à parte", () => {
    const r = planoDoIntervalo(
      [{ year: 2026, months: [
        { month: 7, categories: [{ categoryKey: "LAZER", planned: 0, spent: 900 }] },
        { month: 8, categories: [{ categoryKey: "LAZER", planned: 600, spent: 500 }] },
      ] }],
      [{ year: 2026, month: 7 }, { year: 2026, month: 8 }],
    );
    expect(r.planejado).toBe(600);
    expect(r.gasto).toBe(500);
    expect(r.semPlano).toEqual([{ year: 2026, month: 7, gasto: 900 }]);
  });
});

describe("data de um mês antes do mês em que conta", () => {
  const out = { tipo: "custom" as const, de: { ano: 2026, mes: 10, dia: 1 }, ate: { ano: 2026, mes: 10, dia: 14 } };
  const set = { tipo: "custom" as const, de: { ano: 2026, mes: 9, dia: 1 }, ate: { ano: 2026, mes: 9, dia: 30 } };
  const salario = { year: 2026, month: 10, entryDate: new Date(Date.UTC(2026, 8, 30)) };
  it("o salário de 30/09 contado em outubro entra em 1 a 14 de outubro, e não em setembro", () => {
    expect(dentroDoIntervalo(salario, out)).toBe(true);
    expect(dentroDoIntervalo(salario, set)).toBe(false);
  });
});
