import { describe, expect, it } from "vitest";
import { maiorCategoriaDoMes } from "../monthly";

const rotulo = (g: { parentCategory: string | null; customCategoryId: string | null }) =>
  g.parentCategory === "MORADIA" ? "Moradia" : g.customCategoryId === "pet" ? "Pet" : g.customCategoryId === "academia" ? "Academia" : "?";

describe("maiorCategoriaDoMes", () => {
  it("personalizadas contam pelo próprio nome, não somadas em 'Outros'", () => {
    const top = maiorCategoriaDoMes(
      [
        { amount: 900, parentCategory: null, customCategoryId: "pet" },
        { amount: 600, parentCategory: null, customCategoryId: "academia" },
        { amount: 1400, parentCategory: "MORADIA", customCategoryId: null },
      ],
      rotulo,
    );
    expect(top).toEqual({ label: "Moradia", value: 1400 });
  });

  it("a personalizada pode ser a maior", () => {
    const top = maiorCategoriaDoMes(
      [
        { amount: 500, parentCategory: null, customCategoryId: "pet" },
        { amount: 700, parentCategory: null, customCategoryId: "pet" },
        { amount: 1000, parentCategory: "MORADIA", customCategoryId: null },
      ],
      rotulo,
    );
    expect(top).toEqual({ label: "Pet", value: 1200 });
  });

  it("gasto sem categoria nenhuma não vira a 'maior categoria'", () => {
    const top = maiorCategoriaDoMes(
      [
        { amount: 5000, parentCategory: null, customCategoryId: null },
        { amount: 300, parentCategory: "MORADIA", customCategoryId: null },
      ],
      rotulo,
    );
    expect(top).toEqual({ label: "Moradia", value: 300 });
    expect(maiorCategoriaDoMes([{ amount: 10, parentCategory: null, customCategoryId: null }], rotulo)).toBeNull();
  });
});
