import { describe, expect, it } from "vitest";
import { subcategoriaAposTroca } from "../monthly-entry.repo";

/**
 * Trocar a categoria em lote (modo "Selecionar") não pode deixar o tipo da categoria antiga
 * pra trás: a lista mostra o tipo como título, e a compra do iFood que saiu de Transporte
 * continuava chamada "Aplicativo" dentro de Alimentação.
 */
describe("subcategoriaAposTroca", () => {
  const ifood = { parentCategory: "TRANSPORTE" as const, customCategoryId: null, subcategory: "Aplicativo" };

  it("tira o tipo que não existe na categoria nova", () => {
    expect(subcategoriaAposTroca(ifood, { parentCategory: "ALIMENTACAO", customCategoryId: null }, "PESSOAL")).toBeNull();
  });

  it("mantém o tipo que a categoria nova também tem", () => {
    const iptu = { parentCategory: "MORADIA" as const, customCategoryId: null, subcategory: "IPTU" };
    expect(subcategoriaAposTroca(iptu, { parentCategory: "IMPOSTOS", customCategoryId: null }, "PESSOAL")).toBe("IPTU");
  });

  it("mantém qualquer tipo (até um digitado) quando a categoria não mudou", () => {
    const digitado = { parentCategory: "TRANSPORTE" as const, customCategoryId: null, subcategory: "Uber da firma" };
    expect(subcategoriaAposTroca(digitado, { parentCategory: "TRANSPORTE", customCategoryId: null }, "PESSOAL")).toBe("Uber da firma");
    const pet = { parentCategory: null, customCategoryId: "cat-pet", subcategory: "Ração" };
    expect(subcategoriaAposTroca(pet, { parentCategory: null, customCategoryId: "cat-pet" }, "PESSOAL")).toBe("Ração");
  });

  it("indo pra uma categoria própria, o tipo da categoria-mãe sai", () => {
    expect(subcategoriaAposTroca(ifood, { parentCategory: null, customCategoryId: "cat-pet" }, "PESSOAL")).toBeNull();
  });

  it("saindo de uma categoria própria pra uma categoria-mãe com o mesmo nome de tipo, fica", () => {
    const propria = { parentCategory: null, customCategoryId: "cat-carro", subcategory: "Combustível" };
    expect(subcategoriaAposTroca(propria, { parentCategory: "TRANSPORTE", customCategoryId: null }, "PESSOAL")).toBe("Combustível");
  });

  it("sem tipo continua sem tipo", () => {
    const semTipo = { parentCategory: "OUTROS" as const, customCategoryId: null, subcategory: null };
    expect(subcategoriaAposTroca(semTipo, { parentCategory: "LAZER", customCategoryId: null }, "PESSOAL")).toBeNull();
  });
});
