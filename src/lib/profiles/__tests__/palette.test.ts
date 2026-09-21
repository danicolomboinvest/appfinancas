import { describe, expect, it } from "vitest";
import { PROFILE_COLORS, profileColor, profileColorCss, isProfileColorKey } from "../palette";

describe("paleta dos perfis", () => {
  /**
   * Cor inválida não quebra nada visível: o navegador ignora a variável e a interface
   * simplesmente deixa de pintar, sem erro nenhum. Só um teste pega isso — e já pegou,
   * um valor saiu corrompido na primeira escrita deste arquivo.
   */
  it("toda cor é um hexadecimal de verdade, nos dois temas", () => {
    const hex = /^#[0-9a-f]{6}$/i;
    for (const c of PROFILE_COLORS) {
      for (const tema of ["dark", "light"] as const) {
        const t = c[tema];
        expect(t.accent, `${c.key}.${tema}.accent`).toMatch(hex);
        expect(t.accentStrong, `${c.key}.${tema}.accentStrong`).toMatch(hex);
        expect(t.accent2, `${c.key}.${tema}.accent2`).toMatch(hex);
        expect(t.onAccent, `${c.key}.${tema}.onAccent`).toMatch(hex);
        expect(t.rgb, `${c.key}.${tema}.rgb`).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
      }
    }
  });

  it("não tem cor repetida nem chave duplicada", () => {
    const chaves = PROFILE_COLORS.map((c) => c.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    const acentos = PROFILE_COLORS.map((c) => c.dark.accent);
    expect(new Set(acentos).size).toBe(acentos.length);
  });

  it("oferece as nove cores pedidas", () => {
    expect(PROFILE_COLORS).toHaveLength(9);
    expect(PROFILE_COLORS.map((c) => c.key)).toContain("petroleo");
  });

  /** Perfil salvo com cor de uma versão antiga não pode derrubar a tela. */
  it("cor desconhecida cai no dourado em vez de quebrar", () => {
    expect(profileColor("arco-iris").key).toBe("ambar");
    expect(profileColor(null).key).toBe("ambar");
    expect(isProfileColorKey("arco-iris")).toBe(false);
    expect(isProfileColorKey("vinho")).toBe(true);
  });

  it("o CSS cobre os dois temas e redefine as cinco variáveis", () => {
    const css = profileColorCss("verde");
    expect(css).toContain("--color-accent:");
    expect(css).toContain("--color-accent-strong:");
    expect(css).toContain("--color-accent-2:");
    expect(css).toContain("--color-accent-soft:");
    expect(css).toContain("--color-on-accent:");
    expect(css).toContain('data-theme="light"');
    expect(css).toContain("prefers-color-scheme: light");
    // A cor clara do verde precisa aparecer, senão o tema claro ficaria com a cor do escuro.
    expect(css).toContain("#2f6b48");
  });
});
