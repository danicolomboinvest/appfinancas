import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * As respostas do Decidir ("Deixar assim", a sobra na reserva, o Desfazer) gravam a chave do mês DA
 * PESSOA (30/10/2026): em 05/11, "2026-10" para quem tem o mês começando dia 15 (15/10 a 14/11), e
 * "2026-11" para quem não escolheu dia, como sempre. É a mesma chave que as telas leem.
 */

const banco = vi.hoisted(() => ({ diaInicio: null as number | null, chaves: [] as string[], gravadas: [] as string[] }));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 10, 5, 12) }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: async () => ({ userId: "u1", profileId: "p1", profileKind: "PESSOAL" }) }));
vi.mock("@/lib/repositories/user.repo", () => ({ getDiaInicioMes: async () => banco.diaInicio }));
vi.mock("@/lib/repositories/decisao.repo", () => ({
  registrarDecisaoUnica: async (_ctx: unknown, d: { chave: string }) => {
    banco.gravadas.push(d.chave);
  },
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    decisao: {
      deleteMany: async ({ where }: { where: { chave?: string; OR?: { chave: string }[] } }) => {
        banco.chaves.push(...(where.chave ? [where.chave] : (where.OR ?? []).map((o) => o.chave)));
        return { count: 0 };
      },
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { combinarSobraNaReservaAction, desfazerDispensaAction, desfazerSobraNaReservaAction } from "../actions";

beforeEach(() => {
  banco.diaInicio = null;
  banco.chaves = [];
  banco.gravadas = [];
});

describe("Decidir: a chave do mês das respostas", () => {
  it("sem dia escolhido, em 05/11 a chave é de novembro (como sempre); a da semana não muda", async () => {
    await desfazerDispensaAction("reserva");
    await combinarSobraNaReservaAction(100);
    await desfazerSobraNaReservaAction();
    expect(banco.chaves).toEqual(["2026-11|reserva", "2026-11", "2026-11|reserva"]);
    expect(banco.gravadas).toEqual(["2026-11", "2026-11|reserva"]);
    await desfazerDispensaAction("reserva", "semana");
    expect(banco.chaves.at(-1)).toMatch(/^2026-W\d{2}\|reserva$|^[^|]+\|reserva$/);
    expect(banco.chaves.at(-1)).not.toBe("2026-11|reserva");
  });

  it("dia 15, em 05/11 a chave é de outubro (15/10 a 14/11)", async () => {
    banco.diaInicio = 15;
    await desfazerDispensaAction("reserva");
    await combinarSobraNaReservaAction(100);
    await desfazerSobraNaReservaAction();
    expect(banco.chaves).toEqual(["2026-10|reserva", "2026-10", "2026-10|reserva"]);
    expect(banco.gravadas).toEqual(["2026-10", "2026-10|reserva"]);
  });
});
