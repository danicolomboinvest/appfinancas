import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * As dicas que deixam o orçamento começar preenchido: o mês passado, a média de 3 meses dos
 * gastos e a renda média de 12 meses (13/10/2026: antes era o que entrou no mês passado).
 * Bordas: janeiro (o mês passado é dezembro do ano anterior), conta nova sem nenhum dado,
 * mês vazio no meio da janela, arredondamento da média.
 */
const banco = vi.hoisted(() => ({
  pedidosResumo: [] as { year: number; month: number }[],
  pedidosGasto: [] as { year: number; month: number }[],
  porMae: new Map<string, { parentCategory: string; spent: number }[]>(),
  porPersonalizada: new Map<string, { customCategoryId: string; spent: number }[]>(),
  renda: null as { valor: number; meses: number } | null,
}));

// A média de 12 meses termina no mês de referência: o "hoje" pedido é o 1º do mês seguinte.
vi.mock("@/lib/repositories/renda-media.repo", () => ({
  getRendaMedia: async (_ctx: unknown, hoje: Date) => {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    banco.pedidosResumo.push({ year: ref.getFullYear(), month: ref.getMonth() + 1 });
    return banco.renda;
  },
}));
vi.mock("@/lib/repositories/budget.repo", () => ({
  sumExpensesByParentCategory: async (_ctx: unknown, year: number, month: number) => {
    banco.pedidosGasto.push({ year, month });
    return banco.porMae.get(`${year}-${month}`) ?? [];
  },
  sumExpensesByCustomCategory: async (_ctx: unknown, year: number, month: number) => banco.porPersonalizada.get(`${year}-${month}`) ?? [],
}));

import { getBudgetHints } from "../budget-hints";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;

beforeEach(() => {
  banco.pedidosResumo = [];
  banco.pedidosGasto = [];
  banco.porMae = new Map();
  banco.porPersonalizada = new Map();
  banco.renda = null;
});

describe("getBudgetHints: bordas", () => {
  it("em janeiro, o 'mês passado' é dezembro do ano anterior e a janela é dez/nov/out", async () => {
    const r = await getBudgetHints(ctx, 2027, new Date(2027, 0, 10, 12));
    expect(r.lastMonthLabel).toBe("dezembro");
    expect(banco.pedidosResumo).toEqual([{ year: 2026, month: 12 }]);
    expect(banco.pedidosGasto).toEqual([
      { year: 2026, month: 12 },
      { year: 2026, month: 11 },
      { year: 2026, month: 10 },
    ]);
    expect(r.monthsLeftInYear).toBe(12);
  });

  it("conta nova, sem nenhum dado: médias zero (sem dividir por zero) e renda zero", async () => {
    const r = await getBudgetHints(ctx, 2026, new Date(2026, 8, 30, 12));
    expect(r.rendaMedia).toBe(0);
    expect(r.rendaMediaMeses).toBe(0);
    expect(Object.values(r.averageByCategory).every((v) => v === 0)).toBe(true);
    expect(r.lastMonthByCategory).toEqual({});
  });

  it("a média divide só pelos meses que tiveram gasto (cliente que começou mês passado)", async () => {
    banco.porMae.set("2026-8", [{ parentCategory: "ALIMENTACAO", spent: 900 }]);
    const r = await getBudgetHints(ctx, 2026, new Date(2026, 8, 30, 12));
    expect(r.averageByCategory.ALIMENTACAO).toBe(900);
  });

  it("média arredonda pro real mais próximo e junta categoria-mãe com personalizada", async () => {
    banco.porMae.set("2026-8", [{ parentCategory: "ALIMENTACAO", spent: 100 }]);
    banco.porMae.set("2026-7", [{ parentCategory: "ALIMENTACAO", spent: 100 }]);
    banco.porMae.set("2026-6", [{ parentCategory: "ALIMENTACAO", spent: 101 }]);
    banco.porPersonalizada.set("2026-8", [{ customCategoryId: "pet", spent: 50 }]);
    const r = await getBudgetHints(ctx, 2026, new Date(2026, 8, 30, 12));
    expect(r.averageByCategory.ALIMENTACAO).toBe(100);
    expect(r.averageByCategory.pet).toBe(17);
    expect(r.lastMonthByCategory).toEqual({ ALIMENTACAO: 100, pet: 50 });
  });

  it("último dia de setembro às 23h (Brasília): o mês passado ainda é agosto, e faltam 4 meses", async () => {
    const r = await getBudgetHints(ctx, 2026, new Date(2026, 8, 30, 23, 30));
    expect(r.lastMonthLabel).toBe("agosto");
    expect(r.monthsLeftInYear).toBe(4);
  });

  it("ano que já acabou usa o dezembro dele como referência", async () => {
    const r = await getBudgetHints(ctx, 2025, new Date(2026, 8, 30, 12));
    expect(r.lastMonthLabel).toBe("dezembro");
    expect(banco.pedidosResumo).toEqual([{ year: 2025, month: 12 }]);
  });

  it("a renda sugerida é a média de 12 meses, não o mês passado", async () => {
    banco.renda = { valor: 5500, meses: 12 };
    const r = await getBudgetHints(ctx, 2026, new Date(2026, 9, 13, 12));
    expect(r.rendaMedia).toBe(5500);
    expect(r.rendaMediaMeses).toBe(12);
    expect(banco.pedidosResumo).toEqual([{ year: 2026, month: 9 }]);
  });
});
