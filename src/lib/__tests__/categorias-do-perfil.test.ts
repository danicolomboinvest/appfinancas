import { describe, expect, it } from "vitest";
import { CORES_DE_CATEGORIA, PARENT_CATEGORY_COLOR, categoriaOculta, categoriasParaEscolher, colorForCategorySlice, corEscolhida, corValida, categoryDefaultLabel, categoryIcon, categoryLabel, lerPreferenciasDeCategoria, PARENT_CATEGORIES } from "@/lib/categories";
import { Coffee } from "lucide-react";

/**
 * Categorias editáveis (01/10/2026): cliente queria esconder "Impostos", que não usa, renomear as
 * outras e trocar ícones. A chave gravada nos lançamentos nunca muda; só como o app mostra.
 */
describe("preferências das categorias padrão", () => {
  const prefs = lerPreferenciasDeCategoria({ LAZER: { nome: "  Rolês ", icone: "coffee" }, IMPOSTOS: { oculta: true } });
  const perfil = { kind: "PESSOAL", prefs };

  it("o nome e o ícone dela valem no app; sem preferência, os de fábrica", () => {
    expect(categoryLabel(perfil, "LAZER")).toBe("Rolês");
    expect(categoryIcon(perfil, "LAZER")).toBe(Coffee);
    expect(categoryLabel(perfil, "MORADIA")).toBe(categoryLabel("PESSOAL", "MORADIA"));
    expect(categoryDefaultLabel(perfil, "LAZER")).toBe(categoryLabel("PESSOAL", "LAZER"));
  });

  it("a escondida sai das escolhas e o resto fica na ordem de sempre", () => {
    expect(categoriaOculta(perfil, "IMPOSTOS")).toBe(true);
    expect(categoriasParaEscolher(perfil)).toEqual(PARENT_CATEGORIES.filter((k) => k !== "IMPOSTOS"));
  });

  it("quem só tem o tipo do perfil continua funcionando (crons, telas antigas)", () => {
    expect(categoryLabel("EMPRESA", "MORADIA")).not.toBe(categoryLabel("PESSOAL", "MORADIA"));
    expect(categoriasParaEscolher("PESSOAL")).toEqual(PARENT_CATEGORIES);
  });

  it("não confia no JSON do banco: chave estranha, ícone desconhecido e nome vazio caem fora", () => {
    expect(lerPreferenciasDeCategoria({ HACK: { nome: "x" }, SAUDE: { icone: "<script>", nome: "   " }, LAZER: { oculta: "sim" } })).toEqual({});
    expect(lerPreferenciasDeCategoria(null)).toEqual({});
    expect(lerPreferenciasDeCategoria({ SAUDE: { nome: "a".repeat(80) } }).SAUDE?.nome).toHaveLength(40);
  });
});

/** Cor da categoria (04/10/2026): ela escolhe a cor das padrão e das que criou, só da paleta do app. */
describe("cor escolhida da categoria", () => {
  const prefs = lerPreferenciasDeCategoria({
    LAZER: { cor: "var(--color-custom-3)" },
    SAUDE: { cor: "red; background: url(x)" },
    proprias: { abc: { cor: "var(--color-cat-moradia)" }, ruim: { cor: "#fff" } },
  });
  const perfil = { kind: "PESSOAL", prefs };

  it("vale a cor escolhida, na padrão e na dela", () => {
    expect(colorForCategorySlice({ kind: "parent", value: "LAZER" }, perfil)).toBe("var(--color-custom-3)");
    expect(colorForCategorySlice({ kind: "custom", value: "abc" }, perfil)).toBe("var(--color-cat-moradia)");
    expect(corEscolhida(perfil, "abc")).toBe("var(--color-cat-moradia)");
  });

  it("cor fora da paleta é ignorada e volta a de fábrica", () => {
    expect(prefs.SAUDE?.cor).toBeUndefined();
    expect(prefs.proprias?.ruim).toBeUndefined();
    expect(colorForCategorySlice({ kind: "parent", value: "SAUDE" }, perfil)).toBe(PARENT_CATEGORY_COLOR.SAUDE);
    expect(colorForCategorySlice({ kind: "custom", value: "xyz" }, perfil)).toBe(colorForCategorySlice({ kind: "custom", value: "xyz" }));
  });

  it("toda cor da paleta passa na validação", () => {
    for (const c of CORES_DE_CATEGORIA) expect(corValida(c)).toBe(true);
  });
});
