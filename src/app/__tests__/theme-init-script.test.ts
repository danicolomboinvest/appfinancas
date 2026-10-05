import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "../theme-init-script";

/**
 * O script do <head> é texto: erro de sintaxe nele não aparece no TypeScript nem no build, só no
 * navegador, e derruba o script inteiro. Aconteceu em 05/10/2026: o "\/" de uma regex virou "/"
 * dentro da string, e o tema salvo e as classes do app de iPhone pararam de ser aplicados.
 */
function rodar(userAgent: string, tema: string | null) {
  const classes = new Set<string>();
  const documento = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
  const storage = { getItem: () => tema };
  new Function("document", "navigator", "localStorage", THEME_INIT_SCRIPT)(documento, { userAgent }, storage);
  return [...classes].sort();
}

describe("script de início do tema", () => {
  it("é JavaScript válido", () => {
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });

  it("aplica o tema salvo", () => {
    expect(rodar("Mozilla/5.0", "light")).toEqual(["light"]);
    expect(rodar("Mozilla/5.0", "dark")).toEqual(["dark"]);
    expect(rodar("Mozilla/5.0", null)).toEqual([]);
  });

  it("app de iPhone antigo tira a margem; o novo (/2) não; os dois ganham app-ios", () => {
    expect(rodar("Mozilla/5.0 (iPhone) SPIFinanceApp-iOS", null)).toEqual(["app-ios", "app-margem-nativa"]);
    expect(rodar("Mozilla/5.0 (iPhone) SPIFinanceApp-iOS/2", "light")).toEqual(["app-ios", "light"]);
  });
});
