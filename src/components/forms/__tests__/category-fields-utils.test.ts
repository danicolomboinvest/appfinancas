import { describe, expect, it } from "vitest";
import { initialCategoryState } from "../category-fields-utils";

const ALIMENTACAO = ["Mercado", "Restaurante", "Delivery"];

describe("initialCategoryState", () => {
  it("gasto de categoria personalizada abre com ela marcada e o tipo preenchido", () => {
    const s = initialCategoryState({ defaultCustomCategoryId: "cat-pet", defaultSubcategory: "ração" });
    expect(s.customCategoryId).toBe("cat-pet");
    expect(s.parentCategory).toBeUndefined();
    expect(s.customText).toBe("ração");
  });

  it("categoria personalizada sem tipo abre com o tipo vazio", () => {
    const s = initialCategoryState({ defaultCustomCategoryId: "cat-pet" });
    expect(s.customCategoryId).toBe("cat-pet");
    expect(s.customText).toBe("");
  });

  it("tipo padrão da categoria-mãe vira o chip marcado", () => {
    const s = initialCategoryState({
      defaultParentCategory: "ALIMENTACAO",
      defaultSubcategory: "Mercado",
      standardSubcategories: ALIMENTACAO,
    });
    expect(s).toMatchObject({ parentCategory: "ALIMENTACAO", subcategory: "Mercado", isOutro: false, customCategoryId: undefined });
  });

  it("tipo fora da lista abre como 'Outro' com o texto", () => {
    const s = initialCategoryState({
      defaultParentCategory: "ALIMENTACAO",
      defaultSubcategory: "Feira orgânica",
      standardSubcategories: ALIMENTACAO,
    });
    expect(s).toMatchObject({ isOutro: true, subcategory: undefined, customText: "Feira orgânica" });
  });

  it("lançamento novo começa sem nada escolhido", () => {
    expect(initialCategoryState({})).toEqual({
      parentCategory: undefined,
      customCategoryId: undefined,
      subcategory: undefined,
      isOutro: false,
      customText: "",
    });
  });
});
