import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_THEME,
  PROFILE_THEMES,
  isProfileThemeKey,
  modoEfetivo,
  profileTheme,
  profileThemeCss,
  temaDeixaEscolherModo,
  type ModoTokens,
} from "../themes";

const HEX = /^#[0-9a-f]{6}$/i;
const SOLIDAS = [
  "canvas", "surface", "surface2", "surfaceHover",
  "ink", "inkMuted", "inkFaint",
  "accent", "accentStrong", "accent2", "onAccent",
] as const;

/** Luminância relativa da WCAG — é a mesma conta que as ferramentas de acessibilidade usam. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function cadaModo(fn: (nome: string, m: ModoTokens, tema: string) => void) {
  for (const t of PROFILE_THEMES) {
    fn(t.modo, t.paleta, t.label);
    if (t.paletaAlternativa) fn(t.modo === "escuro" ? "claro" : "escuro", t.paletaAlternativa, t.label);
  }
}

describe("temas de perfil", () => {
  it("tem os sete, com chave única e o padrão entre eles", () => {
    expect(PROFILE_THEMES).toHaveLength(7);
    const chaves = PROFILE_THEMES.map((t) => t.key);
    expect(new Set(chaves).size).toBe(7);
    expect(chaves).toContain(DEFAULT_PROFILE_THEME);
  });

  /** Os nomes são os que a Dani escolheu, em inglês onde ela escolheu em inglês. */
  it("chama os temas pelo nome combinado", () => {
    const nomes = PROFILE_THEMES.map((t) => t.label);
    expect(nomes).toEqual(["Padrão", "Girly", "Minimalista", "Disciplina", "Sem filtro", "Game", "Manifestação"]);
  });

  /**
   * Cada tema tem UM modo, o que ela aprovou no canvas: Girly é branco, Disciplina é preto.
   * A versão anterior inventou um Girly escuro e ligou por padrão — foi o que ela rejeitou.
   * Só o Padrão tem os dois, porque já existia antes e tem gente usando cada um.
   */
  it("só o Padrão tem claro e escuro; os outros seis têm o modo do desenho", () => {
    const modos = Object.fromEntries(PROFILE_THEMES.map((t) => [t.key, t.modo]));
    expect(modos).toEqual({
      padrao: "escuro", girly: "claro", minimalista: "claro", disciplina: "escuro",
      semfiltro: "claro", game: "escuro", manifestacao: "claro",
    });
    for (const t of PROFILE_THEMES) {
      expect(Boolean(t.paletaAlternativa), t.label).toBe(t.key === "padrao");
    }
    expect(temaDeixaEscolherModo("padrao")).toBe(true);
    expect(temaDeixaEscolherModo("girly")).toBe(false);
    // A preferência da pessoa só manda quando o tema deixa.
    expect(modoEfetivo("padrao", "light")).toBe("claro");
    expect(modoEfetivo("padrao", "dark")).toBe("escuro");
    expect(modoEfetivo("girly", "dark")).toBe("claro");
    expect(modoEfetivo("game", "light")).toBe("escuro");
  });

  /** Tema de modo único: a MESMA paleta nos dois blocos, senão a classe errada do anti-flash pisca. */
  it("tema de modo único pinta igual com ou sem a classe light", () => {
    const css = profileThemeCss("girly");
    const [semLight, comLight] = css.split("html.light:root");
    const canvas = (b: string) => b.match(/--color-canvas: (#[0-9a-f]{6})/)![1];
    expect(canvas(semLight)).toBe("#fbf5f7");
    expect(canvas(comLight)).toBe("#fbf5f7");
    const padrao = profileThemeCss("padrao").split("html.light:root");
    expect(canvas(padrao[0])).toBe("#0a0908");
    expect(canvas(padrao[1])).toBe("#ffffff");
  });

  /**
   * Um hexadecimal com um dígito a mais não quebra nada visível: o navegador ignora a variável
   * e a interface deixa de pintar, sem erro nenhum. Só um teste pega — e já pegou, duas vezes
   * neste projeto, uma delas numa cor que eu mesma digitei errado nos desenhos.
   */
  it("toda cor sólida é um hexadecimal de verdade, nos dois modos", () => {
    cadaModo((modo, m, tema) => {
      for (const campo of SOLIDAS) {
        expect(m[campo], `${tema} / ${modo} / ${campo} = ${m[campo]}`).toMatch(HEX);
      }
    });
  });

  it("as bordas são rgba, porque o fundo precisa passar por baixo", () => {
    cadaModo((modo, m, tema) => {
      expect(m.border, `${tema} / ${modo}`).toMatch(/^rgba\(/);
      expect(m.borderStrong, `${tema} / ${modo}`).toMatch(/^rgba\(/);
      const so = (s: string) => Number(s.match(/([\d.]+)\s*\)$/)![1]);
      expect(so(m.borderStrong), `${tema} / ${modo}: forte tem que marcar mais`).toBeGreaterThan(so(m.border));
    });
  });

  /**
   * Este é o teste que justifica o arquivo existir. São sete paletas inventadas à mão para um
   * app onde a pessoa lê NÚMERO DE DINHEIRO — um tema bonito e ilegível é pior que nenhum
   * tema. Os limites são os da WCAG: 4,5:1 pra texto pequeno, 3:1 pra elemento gráfico.
   */
  it("todo texto passa no contraste mínimo, nos dois modos", () => {
    cadaModo((modo, m, tema) => {
      const onde = `${tema} / ${modo}`;
      expect(contraste(m.ink, m.canvas), `${onde}: tinta no fundo`).toBeGreaterThanOrEqual(7);
      expect(contraste(m.ink, m.surface), `${onde}: tinta no cartão`).toBeGreaterThanOrEqual(7);
      expect(contraste(m.inkMuted, m.surface), `${onde}: tinta apagada no cartão`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.inkFaint, m.surface), `${onde}: tinta fraca no cartão`).toBeGreaterThanOrEqual(3);
      // Exceção conhecida e única: o dourado do Padrão no claro dá 3,89:1 com o branco por
      // cima. É a cor da marca, já no ar hoje, e a Dani pediu que o Padrão ficasse como está —
      // então a dívida fica anotada aqui, à vista, em vez de o limite cair pros sete. Se
      // alguém um dia clarear mais esse dourado, este teste cai.
      const alvoBotao = tema === "Padrão" && modo === "claro" ? 3.8 : 4.5;
      expect(contraste(m.onAccent, m.accent), `${onde}: texto dentro do botão`).toBeGreaterThanOrEqual(alvoBotao);
      expect(contraste(m.accent, m.surface), `${onde}: destaque no cartão`).toBeGreaterThanOrEqual(3);
      expect(contraste(m.accent, m.canvas), `${onde}: destaque no fundo`).toBeGreaterThanOrEqual(3);
    });
  });

  it("cai no Padrão quando a chave é desconhecida, em vez de quebrar", () => {
    expect(profileTheme("tema-que-nao-existe").key).toBe(DEFAULT_PROFILE_THEME);
    expect(profileTheme(null).key).toBe(DEFAULT_PROFILE_THEME);
    expect(isProfileThemeKey("girly")).toBe(true);
    expect(isProfileThemeKey("arco-iris")).toBe(false);
  });

  /** Mesma armadilha da paleta de cor: o bloco claro existir não quer dizer que ele se aplica. */
  it("usa o mesmo mecanismo de tema claro que o app", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('classList.add("light")');

    const css = profileThemeCss("girly");
    expect(css).toContain("html.light:root");
    expect(css).toContain("html:not(.light)");
    expect(css).not.toContain("data-theme");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain("#c53d74");
    // Os extras do Girly: as cores de categoria e de gráfico saem em tons de rosa, senão a
    // rosca continua roxa, laranja e azul num tema que é pra ser rosa.
    for (const v of ["cat-moradia", "cat-alimentacao", "cat-lazer", "chart-5", "custom-1", "success", "danger"]) {
      expect(css).toContain(`--color-${v}:`);
    }
    // O Padrão não redefine nada disso: continua como é hoje.
    expect(profileThemeCss("padrao")).not.toContain("--color-cat-");
  });

  it("redefine a paleta inteira, não só o destaque", () => {
    const css = profileThemeCss("game");
    for (const v of ["canvas", "surface", "surface-2", "border", "ink", "ink-muted", "accent", "on-accent"]) {
      expect(css).toContain(`--color-${v}:`);
    }
  });
});
