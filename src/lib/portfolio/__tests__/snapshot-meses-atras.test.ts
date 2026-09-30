import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * getPatrimonySnapshotMonthsAgo (snapshot.ts:27) monta "N meses atrás" com
 * `new Date(ano, mês - N, dia)`: quando o dia não existe no mês de destino, o Date transborda
 * pro mês SEGUINTE. Hoje só é chamado com 12 (insights.ts:413, "cresceu X em 12 meses"), então
 * o caso que acontece de verdade é o 29/02: o "um ano atrás" vira 01/03 do ano anterior. Com
 * N = 1 (se alguém usar pra "no último mês"), 31/03 vira 03/03 — a comparação pega 28 dias.
 *
 * Corrigido: o dia encosta no último dia do mês de destino. Estes testes seguram o conserto.
 */

const banco = vi.hoisted(() => ({
  hoje: new Date(2028, 1, 29, 12),
  consultas: [] as { where: { date: { lte: Date } } }[],
}));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => banco.hoje }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    patrimonySnapshot: {
      findFirst: async (args: { where: { date: { lte: Date } } }) => {
        banco.consultas.push(args);
        return null;
      },
    },
  },
}));

import { getPatrimonySnapshotMonthsAgo } from "../snapshot";

const ctx = { userId: "u1", profileId: "p1" } as unknown as AuthContext;
const dataConsultada = () => {
  const d = banco.consultas.at(-1)!.where.date.lte;
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
};

beforeEach(() => {
  banco.consultas = [];
});

describe("getPatrimonySnapshotMonthsAgo", () => {
  it("controle: dia comum, 12 meses atrás é o mesmo dia do ano anterior", async () => {
    banco.hoje = new Date(2026, 8, 30, 12);
    await getPatrimonySnapshotMonthsAgo(ctx, 12);
    expect(dataConsultada()).toEqual([2025, 9, 30]);
  });

  it("bissexto: em 29/02/2028, \"12 meses atrás\" é 28/02/2027 (não 01/03/2027)", async () => {
    banco.hoje = new Date(2028, 1, 29, 12);
    await getPatrimonySnapshotMonthsAgo(ctx, 12);
    expect(dataConsultada()).toEqual([2027, 2, 28]);
  });

  it("dia 31: em 31/03, \"1 mês atrás\" é 28/02 (não 03/03)", async () => {
    banco.hoje = new Date(2027, 2, 31, 12);
    await getPatrimonySnapshotMonthsAgo(ctx, 1);
    expect(dataConsultada()).toEqual([2027, 2, 28]);
  });

  it("dia 31: em 31/12, \"1 mês atrás\" é 30/11 (não 01/12)", async () => {
    banco.hoje = new Date(2026, 11, 31, 12);
    await getPatrimonySnapshotMonthsAgo(ctx, 1);
    expect(dataConsultada()).toEqual([2026, 11, 30]);
  });
});
