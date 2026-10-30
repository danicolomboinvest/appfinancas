import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O Money Reset olha os "3 últimos meses" a partir do mês DA PESSOA (30/10/2026): em 05/11, para
 * quem tem o mês começando dia 15 o mês de agora é outubro (15/10 a 14/11), então os três são
 * julho, agosto e setembro; sem dia escolhido, agosto, setembro e outubro, como sempre.
 */

const banco = vi.hoisted(() => ({ diaInicio: null as number | null, mesesPedidos: [] as { year: number; month: number }[][] }));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 10, 5, 12) }));
vi.mock("@/lib/repositories/user.repo", () => ({ getDiaInicioMes: async () => banco.diaInicio, getOwnUser: async () => null }));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({
  listEntriesForMonths: async (_ctx: unknown, meses: { year: number; month: number }[]) => {
    banco.mesesPedidos.push(meses);
    return [];
  },
}));
vi.mock("@/lib/repositories/renda-media.repo", () => ({ getRendaMedia: async () => ({ valor: 4000, meses: 3 }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
// O Foco (marco 21) puxa a sessão e o next-auth; aqui só o marco 1 roda.
vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));

import { carregarDadosDoMarco } from "../dados";

const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" } as Parameters<typeof carregarDadosDoMarco>[0];

beforeEach(() => {
  banco.diaInicio = null;
  banco.mesesPedidos = [];
});

describe("Money Reset: os 3 últimos meses no mês da pessoa", () => {
  it("sem dia escolhido, em 05/11: agosto, setembro e outubro, e o mês corrente é novembro", async () => {
    await carregarDadosDoMarco(ctx, 1);
    expect(banco.mesesPedidos[0]).toEqual([{ year: 2026, month: 10 }, { year: 2026, month: 9 }, { year: 2026, month: 8 }]);
    expect(banco.mesesPedidos[1]).toEqual([{ year: 2026, month: 11 }]);
  });

  it("dia 15, em 05/11: julho, agosto e setembro, e o mês corrente é outubro (15/10 a 14/11)", async () => {
    banco.diaInicio = 15;
    await carregarDadosDoMarco(ctx, 1);
    expect(banco.mesesPedidos[0]).toEqual([{ year: 2026, month: 9 }, { year: 2026, month: 8 }, { year: 2026, month: 7 }]);
    expect(banco.mesesPedidos[1]).toEqual([{ year: 2026, month: 10 }]);
  });
});
