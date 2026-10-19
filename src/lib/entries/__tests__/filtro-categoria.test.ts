import { describe, expect, it } from "vitest";
import { chaveDaSub, lerChave, passaNoFiltro, subcategoriasDoPeriodo, tirarCategoria, type LinhaFiltravel } from "../filtro-categoria";

const g = (parentCategory: string | null, subcategory: string | null, customCategoryId: string | null = null): LinhaFiltravel => ({ category: "EXPENSE", parentCategory, customCategoryId, subcategory });
const delivery = g("ALIMENTACAO", "Delivery");
const mercado = g("ALIMENTACAO", "Supermercado");
const semSub = g("ALIMENTACAO", null);
const uber = g("TRANSPORTE", "Aplicativo");
const pet = g(null, "Ração", "cat_pet");
const semCategoria = g(null, null);

describe("filtro de categoria com subcategoria (18/10/2026)", () => {
  it("sem nada marcado, passa tudo", () => {
    expect([delivery, uber, semCategoria].every((e) => passaNoFiltro(e, []))).toBe(true);
  });
  it("só a categoria: tudo dela, com ou sem subcategoria", () => {
    const f = ["ALIMENTACAO"];
    expect([delivery, mercado, semSub].every((e) => passaNoFiltro(e, f))).toBe(true);
    expect(passaNoFiltro(uber, f)).toBe(false);
  });
  it("com subcategoria: só ela dentro da categoria; as outras categorias marcadas seguem inteiras", () => {
    const f = ["ALIMENTACAO", chaveDaSub("ALIMENTACAO", "Delivery"), "TRANSPORTE"];
    expect(passaNoFiltro(delivery, f)).toBe(true);
    expect(passaNoFiltro(mercado, f)).toBe(false);
    expect(passaNoFiltro(semSub, f)).toBe(false);
    expect(passaNoFiltro(uber, f)).toBe(true);
  });
  it("vale para a categoria criada por ela e para o sem categoria", () => {
    expect(passaNoFiltro(pet, ["cat_pet", "cat_pet|Ração"])).toBe(true);
    expect(passaNoFiltro(g(null, "Banho", "cat_pet"), ["cat_pet", "cat_pet|Ração"])).toBe(false);
    expect(passaNoFiltro(semCategoria, ["SEM"])).toBe(true);
  });
  it("a chave", () => {
    expect(lerChave("ALIMENTACAO|Lanche/Café")).toEqual({ categoria: "ALIMENTACAO", sub: "Lanche/Café" });
    expect(lerChave("SEM")).toEqual({ categoria: "SEM", sub: null });
    expect(tirarCategoria(["ALIMENTACAO", "ALIMENTACAO|Delivery", "TRANSPORTE"], "ALIMENTACAO")).toEqual(["TRANSPORTE"]);
  });
  it("as subcategorias do período, por categoria, as mais usadas primeiro", () => {
    const r = subcategoriasDoPeriodo([delivery, delivery, mercado, semSub, uber, pet, { ...delivery, category: "INCOME" }]);
    expect(r).toEqual({ ALIMENTACAO: ["Delivery", "Supermercado"], TRANSPORTE: ["Aplicativo"], cat_pet: ["Ração"] });
  });
});
