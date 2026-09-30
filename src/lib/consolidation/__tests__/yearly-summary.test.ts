import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * O resumo do ano: o que já aconteceu (meses realizados) separado do que só existe por causa da
 * recorrência lançada pra frente. Bordas: ano sem renda (taxa de poupança sem divisão por zero),
 * ano passado, ano futuro, virada do ano.
 */
type Grupo = { month: number; category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION"; _sum: { amount: number | null } };
const banco = vi.hoisted(() => ({ hoje: new Date(2026, 8, 15, 12), grupos: [] as Grupo[] }));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => banco.hoje }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { groupBy: async () => banco.grupos } } }));

import { getYearlySummary } from "../yearly";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;

beforeEach(() => {
  banco.hoje = new Date(2026, 8, 15, 12);
  banco.grupos = [];
});

describe("getYearlySummary: bordas", () => {
  it("ano sem nenhum lançamento: totais zero e taxa de poupança null (não 0/0)", async () => {
    const r = await getYearlySummary(ctx, 2026);
    expect(r.months).toHaveLength(12);
    expect(r.savingsRate).toBeNull();
    expect(r).toMatchObject({ totalIncome: 0, totalExpense: 0, balance: 0, projectedBalance: 0 });
  });

  it("só gasto, sem renda: taxa de poupança null, saldo negativo", async () => {
    banco.grupos = [{ month: 3, category: "EXPENSE", _sum: { amount: 800 } }];
    const r = await getYearlySummary(ctx, 2026);
    expect(r.savingsRate).toBeNull();
    expect(r.balance).toBe(-800);
  });

  it("aluguel recorrente lançado até dezembro não conta como 'já gasto' em setembro", async () => {
    banco.grupos = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, category: "EXPENSE" as const, _sum: { amount: 1000 } }));
    banco.grupos.push({ month: 9, category: "INCOME", _sum: { amount: 12000 } });
    const r = await getYearlySummary(ctx, 2026);
    expect(r.totalExpense).toBe(9000);
    expect(r.projectedTotalExpense).toBe(12000);
    expect(r.savingsRate).toBeCloseTo((12000 - 9000) / 12000);
  });

  it("taxa de poupança pode ser negativa (gastou mais do que entrou)", async () => {
    banco.grupos = [
      { month: 1, category: "INCOME", _sum: { amount: 1000 } },
      { month: 1, category: "EXPENSE", _sum: { amount: 1500 } },
    ];
    expect((await getYearlySummary(ctx, 2026)).savingsRate).toBeCloseTo(-0.5);
  });

  it("virada do ano: em 1º de janeiro, o ano que acabou tem os 12 meses realizados e o novo só janeiro", async () => {
    banco.hoje = new Date(2027, 0, 1, 0, 30);
    banco.grupos = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, category: "INCOME" as const, _sum: { amount: 100 } }));
    expect((await getYearlySummary(ctx, 2026)).totalIncome).toBe(1200);
    expect((await getYearlySummary(ctx, 2027)).totalIncome).toBe(100);
  });

  it("ano futuro: nada realizado, só projeção", async () => {
    banco.grupos = [{ month: 5, category: "EXPENSE", _sum: { amount: 700 } }];
    const r = await getYearlySummary(ctx, 2030);
    expect(r.totalExpense).toBe(0);
    expect(r.projectedTotalExpense).toBe(700);
  });

  it("soma nula do banco conta como zero", async () => {
    banco.grupos = [{ month: 2, category: "INCOME", _sum: { amount: null } }];
    const r = await getYearlySummary(ctx, 2026);
    expect(r.months[1].totalIncome).toBe(0);
    expect(r.savingsRate).toBeNull();
  });
});
