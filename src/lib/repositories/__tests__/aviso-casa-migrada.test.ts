import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * "O casal ficou mais simples" no banco: a casa sabe se veio do Nós dois (migradoEm) e quem já
 * viu o aviso fica guardado no perfil Casal da titular, como o tutorial, uma vez por conta.
 */
type Membro = { id: string; userId: string; letra: string; profileId: string; perfilTitularId: string; perfilParId: string; bloqueadoEm: null; migradoEm: Date | null };
const db = vi.hoisted(() => ({ membro: null as Membro | null, casal: {} as Record<string, unknown>, gravacoes: 0 }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membroCasal: {
      findFirst: async () =>
        db.membro && {
          ...db.membro,
          user: { name: "Lucas Lima", email: "lucas@x.test" },
          profile: { userId: "ana", casal: db.casal, user: { name: "Ana Souza", email: "ana@x.test" } },
        },
    },
    financialProfile: {
      findUnique: async () => ({ casal: db.casal }),
      update: async ({ data }: { data: { casal: Record<string, unknown> } }) => {
        db.casal = data.casal;
        db.gravacoes++;
      },
    },
  },
}));

const { casaDoUsuario, marcarAvisoDaMigracaoVisto } = await import("@/lib/repositories/casa.repo");

const membro = (migradoEm: Date | null): Membro => ({ id: "m1", userId: "lucas", letra: "B", profileId: "casal", perfilTitularId: "pa", perfilParId: "pl", bloqueadoEm: null, migradoEm });
const ctxDe = (casa: CasaNaSessao) => ({ userId: casa.eu.userId, profileId: casa.eu.profileId, role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa }) as AuthContext;

beforeEach(() => {
  db.membro = membro(new Date("2026-10-13T10:00:00Z"));
  db.casal = { nomeA: "Ana", nomeB: "Lucas", divisao: "renda", acertos: [] };
  db.gravacoes = 0;
});

describe("casa migrada", () => {
  it("aparece para a titular e para o par enquanto nenhum dos dois viu", async () => {
    for (const quem of ["ana", "lucas"]) {
      const casa = await casaDoUsuario(quem);
      expect(casa?.migrada).toBe(true);
      expect(casa?.avisoMigracaoVisto).toBe(false);
    }
  });

  it("casa criada já no simples não é migrada", async () => {
    db.membro = membro(null);
    expect((await casaDoUsuario("ana"))?.migrada).toBe(false);
  });

  it("quem não tem casa não tem aviso", async () => {
    db.membro = null;
    expect(await casaDoUsuario("ana")).toBeNull();
  });

  it("uma vez por conta: a titular ver não apaga o aviso do par", async () => {
    const daAna = (await casaDoUsuario("ana"))!;
    expect(await marcarAvisoDaMigracaoVisto(ctxDe(daAna), false)).toBe(true);
    expect((await casaDoUsuario("ana"))?.avisoMigracaoVisto).toBe(true);
    expect((await casaDoUsuario("lucas"))?.avisoMigracaoVisto).toBe(false);
    // De novo: nada a gravar.
    await marcarAvisoDaMigracaoVisto(ctxDe(daAna), false);
    expect(db.gravacoes).toBe(1);

    const doLucas = (await casaDoUsuario("lucas"))!;
    await marcarAvisoDaMigracaoVisto(ctxDe(doLucas), false);
    expect((await casaDoUsuario("lucas"))?.avisoMigracaoVisto).toBe(true);
    expect(db.casal.avisoMigracaoVisto).toEqual(["ana", "lucas"]);
  });

  it("'Ver como funciona' deixa o tutorial para o tutorial; 'Agora não' fecha os dois", async () => {
    const daAna = (await casaDoUsuario("ana"))!;
    await marcarAvisoDaMigracaoVisto(ctxDe(daAna), false);
    expect((await casaDoUsuario("ana"))?.tutorialVisto).toBe(false);

    const doLucas = (await casaDoUsuario("lucas"))!;
    await marcarAvisoDaMigracaoVisto(ctxDe(doLucas), true);
    const depois = (await casaDoUsuario("lucas"))!;
    expect(depois.avisoMigracaoVisto).toBe(true);
    expect(depois.tutorialVisto).toBe(true);
    expect((await casaDoUsuario("ana"))?.tutorialVisto).toBe(false);
    // O resto da configuração da casa fica como estava.
    expect(db.casal).toMatchObject({ nomeA: "Ana", nomeB: "Lucas", divisao: "renda" });
  });

  it("sem casa na sessão não grava nada", async () => {
    const ctx = { userId: "ana", profileId: "pa", role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa: null } as AuthContext;
    expect(await marcarAvisoDaMigracaoVisto(ctx, true)).toBe(false);
    expect(db.gravacoes).toBe(0);
  });
});
