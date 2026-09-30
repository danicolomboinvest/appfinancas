import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O mês montado depois da importação: a action só lê o mês do perfil ATIVO da pessoa, dá nome às
 * categorias e recusa quando a tela é de outro perfil. A conta em si está em
 * lib/import/__tests__/revelacao.test.ts.
 */

const { groupBy, budgetFindMany, customFindMany } = vi.hoisted(() => ({
  groupBy: vi.fn(),
  budgetFindMany: vi.fn(),
  customFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal", profileKind: "PESSOAL" })),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: { groupBy },
    budget: { findMany: budgetFindMany },
    customCategory: { findMany: customFindMany },
  },
}));

const { resumoDoMesImportadoAction } = await import("../revelacao-actions");

beforeEach(() => {
  groupBy.mockReset().mockResolvedValue([
    { category: "INCOME", parentCategory: null, customCategoryId: null, _sum: { amount: 3000 } },
    { category: "EXPENSE", parentCategory: "ALIMENTACAO", customCategoryId: null, _sum: { amount: 600 } },
    { category: "EXPENSE", parentCategory: null, customCategoryId: "pet", _sum: { amount: 200 } },
    { category: "EXPENSE", parentCategory: null, customCategoryId: null, _sum: { amount: 100 } },
  ]);
  budgetFindMany.mockReset().mockResolvedValue([{ parentCategory: "ALIMENTACAO", customCategoryId: null, plannedAmount: 1000 }]);
  customFindMany.mockReset().mockResolvedValue([{ id: "pet", name: "Pet" }]);
});

describe("resumoDoMesImportadoAction", () => {
  it("lê só o mês do perfil ativo e dá nome às categorias", async () => {
    const r = await resumoDoMesImportadoAction(2026, 9, "pessoal");
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", profileId: "pessoal", year: 2026, month: 9 } }));
    expect(budgetFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", profileId: "pessoal", year: 2026, month: 9 } }));
    expect(customFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", profileId: "pessoal" } }));
    expect(r).toMatchObject({ entrou: 3000, saiu: 900, planejado: 1000 });
    expect(r?.maiores.map((m) => m.rotulo)).toEqual(["Alimentação", "Pet"]);
    // Sobra de Alimentação: 400. O mês: 1000 − 900 = 100. Vale o menor.
    expect(r?.livre).toBe(100);
  });

  it("tela de outro perfil: não mostra nada", async () => {
    expect(await resumoDoMesImportadoAction(2026, 9, "empresa")).toBeNull();
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("mês inválido: não consulta", async () => {
    expect(await resumoDoMesImportadoAction(2026, 13, "pessoal")).toBeNull();
    expect(groupBy).not.toHaveBeenCalled();
  });
});
