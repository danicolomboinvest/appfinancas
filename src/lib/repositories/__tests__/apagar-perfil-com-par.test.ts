import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Apagar o perfil Nós dois com o par ligado derrubava o par sem aviso: o vínculo (MembroCasal) cai
 * junto por cascata. Agora a exclusão é recusada e a tela manda tirar o par antes (que é o caminho
 * que avisa o par). Banco de mentira, nenhum e-mail.
 */
const perfis = [
  { id: "pessoal", isDefault: true },
  { id: "casal", isDefault: false },
];
const membros: Array<{ profileId: string; saiuEm: Date | null; modelo: string }> = [];
const apagados: string[] = [];

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    financialProfile: {
      findMany: async () => perfis,
      delete: async ({ where }: { where: { id: string } }) => void apagados.push(where.id),
      update: async () => ({}),
    },
    membroCasal: {
      findFirst: async ({ where }: { where: { profileId: string; saiuEm: null } }) =>
        membros.find((m) => m.profileId === where.profileId && m.saiuEm === null) ?? null,
    },
  },
}));

const { deleteProfile, parLigadoAoPerfil } = await import("../profile.repo");
const ctx = { userId: "ana", profileId: "pessoal" } as AuthContext;

beforeEach(() => {
  membros.length = 0;
  apagados.length = 0;
});

describe("apagar o Nós dois", () => {
  it("com o par ligado: recusa, diz o que fazer e não apaga nada", async () => {
    membros.push({ profileId: "casal", saiuEm: null, modelo: "simples" });
    await expect(deleteProfile(ctx, "casal")).rejects.toThrow(/Tire o seu par antes, em Configurações › Casa/);
    expect(apagados).toEqual([]);
  });

  it("no Nós dois antigo a dica aponta para a tela dele", async () => {
    membros.push({ profileId: "casal", saiuEm: null, modelo: "nos-dois" });
    await expect(deleteProfile(ctx, "casal")).rejects.toThrow(/Configurações › Nós dois/);
  });

  it("depois de tirar o par (saiuEm preenchido) apaga normalmente", async () => {
    membros.push({ profileId: "casal", saiuEm: new Date(), modelo: "simples" });
    await deleteProfile(ctx, "casal");
    expect(apagados).toEqual(["casal"]);
  });

  it("perfil sem par apaga como sempre", async () => {
    await deleteProfile(ctx, "casal");
    expect(apagados).toEqual(["casal"]);
    expect(await parLigadoAoPerfil("pessoal")).toBeNull();
  });
});
