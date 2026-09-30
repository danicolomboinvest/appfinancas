import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * A curva do mês dia a dia e o ranking por categoria, com banco de mentira e "hoje" fixo.
 * Bordas: mês corrente cortado em hoje, fevereiro de ano bissexto, janeiro comparando com o
 * dezembro do ano anterior, mês sem gasto, categoria nova (sem mês anterior).
 *
 * `it.fails` = bug encontrado e não corrigido aqui.
 */
type Linha = { category: "INCOME" | "EXPENSE"; amount: number; entryDate: Date | null };
type Grupo = { parentCategory: string | null; customCategoryId: string | null; _sum: { amount: number | null }; _count?: number };

const banco = vi.hoisted(() => ({
  hoje: new Date(2026, 8, 15, 12),
  lancamentos: [] as Linha[],
  porMes: new Map<string, Grupo[]>(),
  wheres: [] as { year: number; month: number }[],
  personalizadas: [] as { id: string; name: string; icon: string | null }[],
}));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => banco.hoje }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: async () => banco.lancamentos,
      groupBy: async ({ where }: { where: { year: number; month: number } }) => {
        banco.wheres.push({ year: where.year, month: where.month });
        return banco.porMes.get(`${where.year}-${where.month}`) ?? [];
      },
    },
    customCategory: { findMany: async () => banco.personalizadas },
  },
}));

import { getCategorySpending, getDailyFlow } from "../month-analysis";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;
const dia = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

beforeEach(() => {
  banco.hoje = new Date(2026, 8, 15, 12);
  banco.lancamentos = [];
  banco.porMes = new Map();
  banco.wheres = [];
  banco.personalizadas = [];
});

describe("getDailyFlow", () => {
  it("mês sem lançamentos: curva de zeros até o fim, sem NaN", async () => {
    const r = await getDailyFlow(ctx, 2026, 8);
    expect(r.daysInMonth).toBe(31);
    expect(r.points).toHaveLength(31);
    expect(r.points.every((p) => p.income === 0 && p.expense === 0 && p.expenseOfDay === 0)).toBe(true);
    expect(r).toMatchObject({ undatedCount: 0, undatedAmount: 0 });
  });

  it("mês corrente para no dia de hoje: boleto datado pra frente não entra na curva", async () => {
    banco.lancamentos = [
      { category: "EXPENSE", amount: 100, entryDate: dia(2026, 9, 10) },
      { category: "EXPENSE", amount: 999, entryDate: dia(2026, 9, 25) },
    ];
    const r = await getDailyFlow(ctx, 2026, 9);
    expect(r.points).toHaveLength(15);
    expect(r.daysInMonth).toBe(30);
    expect(r.points.at(-1)!.expense).toBe(100);
  });

  it("fevereiro de ano bissexto tem 29 dias; de ano comum, 28", async () => {
    expect((await getDailyFlow(ctx, 2028, 2)).daysInMonth).toBe(29);
    expect((await getDailyFlow(ctx, 2027, 2)).daysInMonth).toBe(28);
  });

  it("a data é lida em UTC: o lançamento do dia 1 não escorrega pro último dia do mês anterior", async () => {
    banco.lancamentos = [{ category: "EXPENSE", amount: 50, entryDate: dia(2026, 8, 1) }];
    const r = await getDailyFlow(ctx, 2026, 8);
    expect(r.points[0]).toEqual({ day: 1, income: 0, expense: 50, expenseOfDay: 50 });
  });

  it("estorno (valor negativo) desce a curva de gastos em vez de ser ignorado", async () => {
    banco.lancamentos = [
      { category: "EXPENSE", amount: 200, entryDate: dia(2026, 8, 3) },
      { category: "EXPENSE", amount: -50, entryDate: dia(2026, 8, 4) },
    ];
    const r = await getDailyFlow(ctx, 2026, 8);
    expect(r.points[3].expense).toBe(150);
  });

  // Era bug (corrigido): `undatedAmount` soma renda E gasto sem data. A página do mês (mensal/[year]/[month]/
  // page.tsx:247) e o Foco (mensal/foco/blocos.ts:62) somam esse número ao "gasto até hoje".
  // Quem lança o salário à mão sem data vê o salário contado como GASTO no "gastando X% a mais
  // que no mês passado". Deveria vir separado (só gasto) ou a renda sem data ficar de fora.
  it("renda sem data não entra no valor sem data que é somado ao gasto", async () => {
    banco.lancamentos = [
      { category: "INCOME", amount: 5000, entryDate: null },
      { category: "EXPENSE", amount: 300, entryDate: null },
    ];
    const r = await getDailyFlow(ctx, 2026, 9);
    expect(r.undatedAmount).toBe(300);
  });
});

describe("getCategorySpending", () => {
  const rotulos = { MORADIA: "Moradia", ALIMENTACAO: "Alimentação" };

  it("janeiro compara com o dezembro do ano ANTERIOR", async () => {
    await getCategorySpending(ctx, 2027, 1, rotulos);
    expect(banco.wheres).toContainEqual({ year: 2026, month: 12 });
    expect(banco.wheres).toContainEqual({ year: 2027, month: 1 });
  });

  it("mês sem gasto (ou só estorno) devolve lista vazia, sem dividir por zero", async () => {
    expect(await getCategorySpending(ctx, 2026, 9, rotulos)).toEqual([]);
    banco.porMes.set("2026-9", [{ parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: -80 }, _count: 1 }]);
    expect(await getCategorySpending(ctx, 2026, 9, rotulos)).toEqual([]);
  });

  it("a fatia conta o gasto sem categoria no total, e as fatias somam menos que 100%", async () => {
    banco.porMes.set("2026-9", [
      { parentCategory: "MORADIA", customCategoryId: null, _sum: { amount: 2900 }, _count: 1 },
      { parentCategory: null, customCategoryId: null, _sum: { amount: 7100 }, _count: 4 },
    ]);
    const r = await getCategorySpending(ctx, 2026, 9, rotulos);
    expect(r).toHaveLength(1);
    expect(r[0].share).toBeCloseTo(0.29);
  });

  it("categoria sem gasto no mês anterior não vira 'subiu infinito%' (changeRatio null)", async () => {
    banco.porMes.set("2026-9", [{ parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: 500 }, _count: 2 }]);
    banco.porMes.set("2026-8", [{ parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: 0 } }]);
    const [a] = await getCategorySpending(ctx, 2026, 9, rotulos);
    expect(a.previousAmount).toBe(0);
    expect(a.changeRatio).toBeNull();
  });

  it("variação contra o mês anterior: 400 → 500 é +25%", async () => {
    banco.porMes.set("2026-9", [{ parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: 500 }, _count: 2 }]);
    banco.porMes.set("2026-8", [{ parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: 400 } }]);
    const [a] = await getCategorySpending(ctx, 2026, 9, rotulos);
    expect(a.changeRatio).toBeCloseTo(0.25);
  });

  it("categoria personalizada apagada aparece como 'Outro', sem quebrar", async () => {
    banco.porMes.set("2026-9", [{ parentCategory: null, customCategoryId: "sumiu", _sum: { amount: 120 }, _count: 1 }]);
    const [a] = await getCategorySpending(ctx, 2026, 9, rotulos);
    expect(a).toMatchObject({ kind: "custom", key: "sumiu", label: "Outro", iconKey: null, share: 1 });
  });
});
