import { describe, expect, it } from "vitest";
import { classify, type LearnedRule } from "../classify";

// A regra que ela ensinou com uma categoria criada por ela ("Pet") volta com a personalizada.
// Descrições FICTÍCIAS.
describe("regra aprendida com categoria personalizada", () => {
  const regras: LearnedRule[] = [
    { pattern: "petshop amigo fiel", parentCategory: "OUTROS", customCategoryId: "cat-pet" },
    { pattern: "padaria estrela", parentCategory: "ALIMENTACAO" },
  ];

  it("devolve a categoria personalizada quando a regra tem uma", () => {
    expect(classify("PIX ENVIADO PETSHOP AMIGO FIEL", regras)).toEqual({ parentCategory: "OUTROS", subcategory: undefined, customCategoryId: "cat-pet" });
  });

  it("regra sem personalizada continua como sempre (sem o campo)", () => {
    const achada = classify("PADARIA ESTRELA LTDA", regras);
    expect(achada).toEqual({ parentCategory: "ALIMENTACAO", subcategory: undefined });
    expect(achada && "customCategoryId" in achada).toBe(false);
  });
});
