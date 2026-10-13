import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * Sair da casa (Casal simples): a titular tira o par, o par sai. Ninguém faz o papel do outro,
 * nada é movido (cada um já está no próprio Pessoal) e quem saiu fica 90 dias na tela de pausa.
 */

type Membro = { id: string; userId: string; modelo: string; saiuEm: Date | null; motivoSaida: string | null; letra: string; profile: { casal: unknown; user: { name: string; email: string } } };
const db = vi.hoisted(() => ({ membros: [] as Membro[], casal: {} as Record<string, unknown>, lancamentosMovidos: 0 }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membroCasal: {
      updateMany: async ({ where, data }: { where: { id: string; saiuEm: null; modelo: string }; data: Partial<Membro> }) => {
        const alvo = db.membros.filter((m) => m.id === where.id && m.saiuEm === null && m.modelo === where.modelo);
        alvo.forEach((m) => Object.assign(m, data));
        return { count: alvo.length };
      },
      findFirst: async ({ where }: { where: { userId: string; saiuEm: { gt: Date } } }) =>
        db.membros.filter((m) => m.userId === where.userId && m.modelo === "simples" && m.saiuEm && m.saiuEm > where.saiuEm.gt).sort((a, b) => b.saiuEm!.getTime() - a.saiuEm!.getTime())[0] ?? null,
    },
    financialProfile: {
      findUnique: async () => ({ casal: db.casal }),
      update: async ({ data }: { data: { casal: Record<string, unknown> } }) => {
        db.casal = data.casal;
      },
    },
    monthlyEntry: {
      updateMany: async () => {
        db.lancamentosMovidos++;
        return { count: 0 };
      },
    },
  },
}));

const { sairDaCasa, saidaRecenteDaCasa, salvarNomesDaCasa } = await import("@/lib/repositories/casa.repo");

const ANA = { userId: "ana", profileId: "pa", letra: "A" as const, nome: "Ana", papel: "titular" as const };
const LUCAS = { userId: "lucas", profileId: "pl", letra: "B" as const, nome: "Lucas", papel: "par" as const };
const casa = (eu: typeof ANA | typeof LUCAS, outro: typeof ANA | typeof LUCAS): CasaNaSessao => ({ membroId: "m1", casalProfileId: "casal", eu, outro });
const ctx = (eu: typeof ANA | typeof LUCAS, outro: typeof ANA | typeof LUCAS) => ({ userId: eu.userId, profileId: eu.profileId, role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa: casa(eu, outro) }) as AuthContext;
const AGORA = new Date("2026-10-13T12:00:00Z");

beforeEach(() => {
  db.membros = [{ id: "m1", userId: "lucas", modelo: "simples", saiuEm: null, motivoSaida: null, letra: "B", profile: { casal: { nomeA: "Ana", nomeB: "Lucas" }, user: { name: "Ana Souza", email: "ana@x.test" } } }];
  db.casal = { nomeA: "Ana", nomeB: "Lucas", divisao: "renda", acertos: ["2026-09"] };
  db.lancamentosMovidos = 0;
});

describe("sair da casa", () => {
  it("a titular tira o par; o par não tira ninguém, só sai", async () => {
    expect(await sairDaCasa(ctx(LUCAS, ANA), "titular", AGORA)).toBe(0);
    expect(await sairDaCasa(ctx(ANA, LUCAS), "par", AGORA)).toBe(0);
    expect(await sairDaCasa(ctx(ANA, LUCAS), "titular", AGORA)).toBe(1);
    expect(db.membros[0]).toMatchObject({ saiuEm: AGORA, motivoSaida: "removido" });
    // Nada é movido: cada um já está no próprio Pessoal. O acerto fica com a titular.
    expect(db.lancamentosMovidos).toBe(0);
    expect(db.casal.acertos).toEqual(["2026-09"]);
  });

  it("o par sai, e por 90 dias vê a tela de pausa com a data", async () => {
    expect(await sairDaCasa(ctx(LUCAS, ANA), "par", AGORA)).toBe(1);
    expect(db.membros[0].motivoSaida).toBe("saiu");
    const saida = await saidaRecenteDaCasa("lucas", new Date("2026-11-01T12:00:00Z"));
    expect(saida).toMatchObject({ nomeTitular: "Ana", motivo: "saiu" });
    expect(saida?.ate.toISOString().slice(0, 10)).toBe("2027-01-11");
    expect(await saidaRecenteDaCasa("lucas", new Date("2027-02-01T12:00:00Z"))).toBeNull();
  });

  it("sem casa ativa não sai nada", async () => {
    expect(await sairDaCasa({ ...ctx(ANA, LUCAS), casa: null }, "titular", AGORA)).toBe(0);
  });
});

describe("nomes da casa", () => {
  it("cada login grava o seu nome e o do outro na letra certa", async () => {
    await salvarNomesDaCasa(ctx(LUCAS, ANA), "Luquinhas", "Aninha");
    expect(db.casal).toMatchObject({ nomeA: "Aninha", nomeB: "Luquinhas", acertos: ["2026-09"] });
  });
});
