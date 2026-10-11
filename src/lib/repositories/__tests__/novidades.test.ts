import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Tivemos uma mudança": a marca da conta. Quem já usava fica com nulo e vê uma vez; quem passa
 * pelo /comecar (chegou com a versão nova) ganha "novo" e nunca vê; ver ou pular grava uma vez só.
 */
const findUnique = vi.fn<(a: unknown) => Promise<unknown>>(async () => null);
const update = vi.fn<(a: unknown) => Promise<unknown>>(async () => ({}));
const updateMany = vi.fn<(a: unknown) => Promise<unknown>>(async () => ({ count: 1 }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: (a: unknown) => findUnique(a), update: (a: unknown) => update(a), updateMany: (a: unknown) => updateMany(a) } },
}));

const { lerEstadoDasNovidades, marcarNovidadesVistas } = await import("../novidades.repo");
const { markOnboarded } = await import("../user.repo");

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  updateMany.mockReset();
});

describe("estado da conta", () => {
  it("usuário antigo (marca vazia) vê", async () => {
    findUnique.mockResolvedValue({ novidadesVersaoNova: null });
    expect(await lerEstadoDasNovidades("u1")).toBe("mostrar");
  });

  it("usuária nova vê o Boas-vindas uma vez; depois de ver, não vê mais", async () => {
    findUnique.mockResolvedValue({ novidadesVersaoNova: "novo" });
    expect(await lerEstadoDasNovidades("u1")).toBe("boas-vindas");
    findUnique.mockResolvedValue({ novidadesVersaoNova: "novo-visto" });
    expect(await lerEstadoDasNovidades("u1")).toBe("novo");
  });

  it("quem pulou não vê de novo sozinho", async () => {
    findUnique.mockResolvedValue({ novidadesVersaoNova: "pulou" });
    expect(await lerEstadoDasNovidades("u1")).toBe("visto");
  });
});

describe("gravar", () => {
  it("ver ou pular grava só se ainda estava vazio (rever pela Ajuda não muda a marca, e o novo continua novo)", async () => {
    await marcarNovidadesVistas("u1", "pulou");
    const arg = updateMany.mock.calls[0][0] as { where: unknown; data: { novidadesVersaoNova: string } };
    expect(arg.where).toEqual({ id: "u1", novidadesVersaoNova: null });
    expect(arg.data.novidadesVersaoNova).toBe("pulou");
    // A nova que viu o Boas-vindas vira "novo-visto" (e quem já usava não é tocado por essa linha).
    const nova = updateMany.mock.calls[1][0] as { where: unknown; data: { novidadesVersaoNova: string } };
    expect(nova.where).toEqual({ id: "u1", novidadesVersaoNova: "novo" });
    expect(nova.data.novidadesVersaoNova).toBe("novo-visto");
  });

  it("quem termina o /comecar vira 'novo'", async () => {
    findUnique.mockResolvedValue({ novidadesVersaoNova: null });
    await markOnboarded("u2");
    const arg = update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.novidadesVersaoNova).toBe("novo");
    expect(arg.data.onboardedAt).toBeInstanceOf(Date);
  });
});
