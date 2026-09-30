import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * O resumo do mês e do ano (renda, gastos, guardado e saldo) com o banco de mentira: nenhum
 * teste aqui toca o banco de verdade. Bordas: mês sem dados, saldo negativo, centavos que não
 * podem virar 0,30000000000000004.
 */
const banco = vi.hoisted(() => ({ linhas: [] as { category: string; _sum: { amount: unknown } }[], ultimoWhere: null as unknown }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      groupBy: async ({ where }: { where: unknown }) => {
        banco.ultimoWhere = where;
        return banco.linhas;
      },
    },
  },
}));

import { getAnnualSummary, getMonthlySummary } from "../monthly";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;

beforeEach(() => {
  banco.linhas = [];
  banco.ultimoWhere = null;
});

describe("getMonthlySummary", () => {
  it("mês sem nenhum lançamento: tudo zero, sem NaN", async () => {
    expect(await getMonthlySummary(ctx, 2026, 9)).toEqual({ totalIncome: 0, totalExpense: 0, totalInvestment: 0, balance: 0 });
  });

  it("soma nula do banco (_sum.amount null) conta como zero", async () => {
    banco.linhas = [{ category: "INCOME", _sum: { amount: null } }, { category: "EXPENSE", _sum: { amount: "150.25" } }];
    expect(await getMonthlySummary(ctx, 2026, 9)).toEqual({ totalIncome: 0, totalExpense: 150.25, totalInvestment: 0, balance: -150.25 });
  });

  it("saldo = renda - gastos - guardado, e pode ser negativo", async () => {
    banco.linhas = [
      { category: "INCOME", _sum: { amount: "3000" } },
      { category: "EXPENSE", _sum: { amount: "2800.50" } },
      { category: "INVESTMENT_CONTRIBUTION", _sum: { amount: "500" } },
    ];
    const r = await getMonthlySummary(ctx, 2026, 9);
    expect(r.balance).toBe(-300.5);
  });

  it("centavos exatos: 0,10 + 0,20 de renda menos 0,30 de gasto é zero, não 5e-17", async () => {
    banco.linhas = [
      { category: "INCOME", _sum: { amount: "0.3" } },
      { category: "EXPENSE", _sum: { amount: "0.1" } },
      { category: "INVESTMENT_CONTRIBUTION", _sum: { amount: "0.2" } },
    ];
    expect((await getMonthlySummary(ctx, 2026, 9)).balance).toBe(0);
  });

  it("filtra pelo perfil ativo e pelo mês pedido", async () => {
    await getMonthlySummary(ctx, 2027, 1);
    expect(banco.ultimoWhere).toEqual({ userId: "u1", profileId: "p1", year: 2027, month: 1 });
  });
});

describe("getAnnualSummary", () => {
  it("ano sem dados é zero; filtra só pelo ano (sem mês)", async () => {
    expect(await getAnnualSummary(ctx, 2026)).toEqual({ totalIncome: 0, totalExpense: 0, totalInvestment: 0, balance: 0 });
    expect(banco.ultimoWhere).toEqual({ userId: "u1", profileId: "p1", year: 2026 });
  });

  it("estorno maior que as compras (gasto negativo) aumenta o saldo em vez de quebrar", async () => {
    banco.linhas = [{ category: "INCOME", _sum: { amount: "1000" } }, { category: "EXPENSE", _sum: { amount: "-50" } }];
    expect((await getAnnualSummary(ctx, 2026)).balance).toBe(1050);
  });
});
