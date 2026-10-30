import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Casal simples (20/10/2026, pedido de um cliente): a categoria que um criou aparecia para o outro
 * como "Categoria personalizada", sem o nome. O nome vem do dono, só para ler.
 */
const findMany = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
vi.mock("@/lib/db/prisma", () => ({ prisma: { customCategory: { findMany: (...a: unknown[]) => findMany(...a) } } }));

const { categoriasDoParPorId, juntarRotulosDasPersonalizadas, rotulosDasPersonalizadas } = await import("../casa.repo");

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

describe("o rótulo de cada personalizada nas telas (30/10/2026: gráfico do Resumo, Orçamento, Gastos, Foco)", () => {
  it("junta as minhas com as do par; a minha ganha se o id coincidir; id de ninguém fica de fora", () => {
    const r = juntarRotulosDasPersonalizadas(
      [{ id: "c1", name: "Academia", icon: "dumbbell" }, { id: "c2", name: "Minha", icon: null }],
      [{ id: "c9", name: "Pet", icon: "paw" }, { id: "c2", name: "Dele", icon: "x" }],
    );
    expect(r.get("c1")).toEqual({ name: "Academia", icon: "dumbbell" });
    expect(r.get("c9")).toEqual({ name: "Pet", icon: "paw" });
    expect(r.get("c2")).toEqual({ name: "Minha", icon: null });
    expect(r.has("c7")).toBe(false);
  });

  it("consulta o par só pelos ids que não são meus, sem repetir e sem nulos", async () => {
    findMany.mockResolvedValueOnce([{ id: "c9", name: "Pet", icon: "paw" }]);
    const r = await rotulosDasPersonalizadas(ctxComCasa, [{ id: "c1", name: "Academia", icon: "dumbbell" }], ["c1", "c9", null, "c9", undefined, "c7"]);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["c9", "c7"] }, userId: "u2", profileId: "p2" } });
    expect(r.get("c9")?.name).toBe("Pet");
    expect(r.get("c1")?.name).toBe("Academia");
    expect(r.has("c7")).toBe(false);
  });

  it("sem casa, é só a minha lista e não consulta nada", async () => {
    const r = await rotulosDasPersonalizadas(ctxSemCasa, [{ id: "c1", name: "Academia", icon: "dumbbell" }], ["c1", "c9"]);
    expect([...r.keys()]).toEqual(["c1"]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("só com ids meus não consulta o par", async () => {
    await rotulosDasPersonalizadas(ctxComCasa, [{ id: "c1", name: "Academia", icon: "dumbbell" }], ["c1", "c1"]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
