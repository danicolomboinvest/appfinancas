import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O progresso das metas no mês da pessoa (30/10/2026). Com o mês começando dia 15, em 05/11 o mês
 * de agora é outubro (15/10 a 14/11): o aporte gravado em outubro é "deste mês" (o card não oferece
 * "Marcar aporte" de novo) e a cópia de novembro do "Repetir todo mês" ainda não conta como guardado.
 * Sem dia escolhido, o mês do calendário, como sempre.
 */

const banco = vi.hoisted(() => ({ diaInicioMes: null as number | null, chamadasAoUsuario: 0 }));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 10, 5, 12) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: async () => {
        banco.chamadasAoUsuario += 1;
        return { diaInicioMes: banco.diaInicioMes };
      },
    },
    goal: { findMany: async () => [{ id: "g1", name: "Viagem", currentAmount: 0, targetAmount: 5000, createdAt: new Date(2026, 8, 1) }] },
    asset: { groupBy: async () => [] },
    monthlyEntry: {
      findMany: async ({ where }: { where: { OR: ({ year: { lt: number } } | { year: number; month: { lte: number } })[] } }) => {
        const aportes = [
          { goalId: "g1", year: 2026, month: 10, amount: 500, createdAt: new Date("2026-10-20T12:00:00.000Z"), allocations: [] },
          { goalId: "g1", year: 2026, month: 11, amount: 500, createdAt: new Date("2026-10-20T12:00:00.000Z"), allocations: [] },
        ];
        return aportes.filter((a) => where.OR.some((c) => (typeof c.year === "number" ? a.year === c.year && a.month <= c.month.lte : a.year < c.year.lt)));
      },
    },
  },
}));

import { listGoalsWithProgress } from "../goal.repo";

const ctx = { userId: "u1", profileId: "p1" } as Parameters<typeof listGoalsWithProgress>[0];

beforeEach(() => {
  banco.diaInicioMes = null;
  banco.chamadasAoUsuario = 0;
});

describe("listGoalsWithProgress e o mês da pessoa", () => {
  it("sem dia escolhido, em 05/11: novembro é o mês de agora, os dois aportes contam e há aporte no mês", async () => {
    const [g] = await listGoalsWithProgress(ctx);
    expect(g.computedCurrentAmount).toBe(1000);
    expect(g.temAporteNoMes).toBe(true);
    expect(banco.chamadasAoUsuario).toBe(1);
  });

  it("dia 15, em 05/11: outubro é o mês de agora, só o aporte de outubro conta e ele é o deste mês", async () => {
    banco.diaInicioMes = 15;
    const [g] = await listGoalsWithProgress(ctx);
    expect(g.computedCurrentAmount).toBe(500);
    expect(g.temAporteNoMes).toBe(true);
  });

  it("quem já tem o dia manda, sem leitura da conta", async () => {
    const [g] = await listGoalsWithProgress(ctx, 15);
    expect(g.computedCurrentAmount).toBe(500);
    expect(banco.chamadasAoUsuario).toBe(0);
    const [semDia] = await listGoalsWithProgress(ctx, null);
    expect(semDia.computedCurrentAmount).toBe(1000);
  });
});
