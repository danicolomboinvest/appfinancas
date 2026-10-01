import { describe, expect, it } from "vitest";
import { categoriaOculta, categoriasParaEscolher, categoryDefaultLabel, categoryIcon, categoryLabel, lerPreferenciasDeCategoria, PARENT_CATEGORIES } from "@/lib/categories";
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
