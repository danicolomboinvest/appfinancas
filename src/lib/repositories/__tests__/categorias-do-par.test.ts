import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Casal simples (20/10/2026, pedido de um cliente): a categoria que um criou aparecia para o outro
 * como "Categoria personalizada", sem o nome. O nome vem do dono, só para ler.
 */
const findMany = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
vi.mock("@/lib/db/prisma", () => ({ prisma: { customCategory: { findMany: (...a: unknown[]) => findMany(...a) } } }));

const { categoriasDoParPorId } = await import("../casa.repo");

const casa = { eu: { userId: "u1", profileId: "p1", nome: "Eu" }, outro: { userId: "u2", profileId: "p2", nome: "Par" } };
const ctxComCasa = { userId: "u1", profileId: "p1", casa } as never;
const ctxSemCasa = { userId: "u1", profileId: "p1" } as never;

beforeEach(() => findMany.mockClear());

describe("nome da categoria do par", () => {
  it("busca só categorias do perfil Pessoal do par, pelos ids que aparecem nos lançamentos", async () => {
    findMany.mockResolvedValueOnce([{ id: "c9", name: "Pet", icon: "paw" }]);
    const r = await categoriasDoParPorId(ctxComCasa, ["c9"]);
    expect(r).toEqual([{ id: "c9", name: "Pet", icon: "paw" }]);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["c9"] }, userId: "u2", profileId: "p2" } });
  });
  it("sem casa, ou sem ids, não consulta nada (ninguém lê categoria de quem não é par)", async () => {
    expect(await categoriasDoParPorId(ctxSemCasa, ["c9"])).toEqual([]);
    expect(await categoriasDoParPorId(ctxComCasa, [])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
