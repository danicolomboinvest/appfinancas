import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHAVES_QUE_SAIRAM,
  DEFAULT_PROFILE_THEME,
  PROFILE_THEMES,
  chaveDoTema,
  isProfileThemeKey,
  modoEfetivo,
  preferenciaDeModo,
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

/** Luminância relativa da WCAG: é a mesma conta que as ferramentas de acessibilidade usam. */
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
    fn("claro", t.paleta, t.label);
    fn("escuro", t.paletaAlternativa, t.label);
  }
}

describe("os quatro temas da versão nova", () => {
  it("são Padrão, Girly, Manifestação e Titânio, com chave única", () => {
    expect(PROFILE_THEMES.map((t) => t.key)).toEqual(["padrao", "girly", "manifestacao", "titanio"]);
    expect(PROFILE_THEMES.map((t) => t.label)).toEqual(["Padrão", "Girly", "Manifestação", "Titânio"]);
    expect(DEFAULT_PROFILE_THEME).toBe("padrao");
  });

  it("todo tema tem claro e escuro, e quem decide é a pessoa", () => {
    for (const t of PROFILE_THEMES) {
      expect(t.paleta.canvas, t.label).not.toBe(t.paletaAlternativa.canvas);
      expect(luminancia(t.paleta.canvas), `${t.label}: o claro é claro`).toBeGreaterThan(0.7);
      expect(luminancia(t.paletaAlternativa.canvas), `${t.label}: o escuro é escuro`).toBeLessThan(0.02);
      expect(temaDeixaEscolherModo(t.key)).toBe(true);
      expect(modoEfetivo(t.key, "light")).toBe("claro");
      expect(modoEfetivo(t.key, "dark")).toBe("escuro");
    }
    // Automático: o servidor não sabe o modo do celular, chuta claro; o aparelho corrige.
    expect(modoEfetivo("girly", "auto")).toBe("claro");
    expect(preferenciaDeModo("auto")).toBe("auto");
    expect(preferenciaDeModo("qualquer")).toBe("light");
  });

  it("cada tema tem a sua letra (e só o Girly tem letra de título própria)", () => {
    const fonte = (k: string) => profileTheme(k).paleta.extras?.["--font-tema"];
    expect(fonte("padrao")).toBe("var(--font-figtree)");
    expect(fonte("girly")).toBe("var(--font-hanken)");
    expect(fonte("manifestacao")).toBe("var(--font-urbanist)");
    expect(fonte("titanio")).toBe("var(--font-archivo)");
    expect(profileTheme("girly").paleta.extras?.["--font-titulo"]).toBe("var(--font-cormorant)");
    expect(profileTheme("girly").paleta.extras?.["--estilo-titulo"]).toBe("italic");
    for (const k of ["padrao", "manifestacao", "titanio"]) expect(profileTheme(k).paleta.extras?.["--font-titulo"]).toBeUndefined();
    // As quatro letras são carregadas no layout raiz.
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    for (const f of ["Figtree", "Hanken_Grotesk", "Cormorant_Garamond", "Urbanist", "Archivo"]) expect(layout).toContain(f);
  });

  it("o Titânio segue a especificação: titânio com laranja no claro, grafite C1 no escuro", () => {
    const t = profileTheme("titanio");
    expect(t.paleta.extras?.["heroi-de"]).toBe("#c9ccd1");
    expect(t.paleta.extras?.["heroi-destaque"]).toBe("#d9480f");
    expect(t.paletaAlternativa.accent).toBe("#ff7a3d");
    expect(t.paletaAlternativa.extras?.["--fundo-tema"]).toContain("#1b1d21");
    expect(t.paletaAlternativa.extras?.["--fundo-tema"]).toContain("#141518");
    expect(t.paletaAlternativa.extras?.["heroi-de"]).toBe("#3a3e46");
    expect(t.paletaAlternativa.extras?.["heroi-para"]).toBe("#2a2d33");
  });

  it("cada tema tem a sua paleta de categorias, no claro e no escuro", () => {
    const cats = ["moradia", "alimentacao", "transporte", "saude", "lazer", "educacao", "impostos", "outros"];
    const assinaturas = new Set<string>();
    cadaModo((modo, m, tema) => {
      const cores = cats.map((c) => m.extras?.[`cat-${c}`]);
      for (const c of cores) expect(c, `${tema}/${modo}`).toMatch(HEX);
      assinaturas.add(cores.join(","));
    });
    expect(assinaturas.size, "nenhum tema/modo repete a paleta de outro").toBe(8);
  });

  it("toda cor sólida é um hexadecimal de verdade, nos dois modos", () => {
    cadaModo((modo, m, tema) => {
      for (const campo of SOLIDAS) expect(m[campo], `${tema} / ${modo} / ${campo} = ${m[campo]}`).toMatch(HEX);
    });
  });

  it("as bordas são rgba, porque o fundo precisa passar por baixo", () => {
    cadaModo((modo, m, tema) => {
      expect(m.border, `${tema} / ${modo}`).toMatch(/^rgba\(/);
      const so = (s: string) => Number(s.match(/([\d.]+)\s*\)$/)![1]);
      expect(so(m.borderStrong), `${tema} / ${modo}: forte tem que marcar mais`).toBeGreaterThan(so(m.border));
    });
  });

  /** Um tema bonito e ilegível é pior que nenhum: os limites da WCAG, nos dois modos. */
  it("todo texto passa no contraste mínimo, nos dois modos", () => {
    cadaModo((modo, m, tema) => {
      const onde = `${tema} / ${modo}`;
      expect(contraste(m.ink, m.canvas), `${onde}: tinta no fundo`).toBeGreaterThanOrEqual(7);
      expect(contraste(m.ink, m.surface), `${onde}: tinta no cartão`).toBeGreaterThanOrEqual(7);
      expect(contraste(m.inkMuted, m.surface), `${onde}: tinta apagada no cartão`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.inkFaint, m.surface), `${onde}: tinta fraca no cartão`).toBeGreaterThanOrEqual(3);
      expect(contraste(m.onAccent, m.accent), `${onde}: texto dentro do botão`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.accent, m.surface), `${onde}: destaque no cartão`).toBeGreaterThanOrEqual(3);
      expect(contraste(m.accent, m.canvas), `${onde}: destaque no fundo`).toBeGreaterThanOrEqual(3);
      const heroi = m.extras!;
      expect(contraste(heroi["heroi-tinta"], heroi["heroi-de"]), `${onde}: número do herói`).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("usa o mesmo mecanismo de tema claro que o app, com as duas paletas", () => {
    const script = readFileSync("src/app/theme-init-script.ts", "utf8");
    expect(script).toContain('classList.add("light")');
    expect(script).toContain("prefers-color-scheme: dark");
    const css = profileThemeCss("girly");
    const [escuro, claro] = css.split("html.light:root");
    expect(escuro).toContain("html:not(.light)");
    expect(escuro).toContain("--color-canvas: #130c0f");
    expect(claro).toContain("--color-canvas: #faf5f3");
    for (const v of ["cat-moradia", "cat-lazer", "chart-5", "custom-1", "success", "danger", "heroi-de", "pill"]) {
      expect(escuro).toContain(`--color-${v}:`);
      expect(claro).toContain(`--color-${v}:`);
    }
  });
});

describe("logo Aurora por tema", () => {
  it("cada tema aponta para a sua variante, e o arquivo existe", () => {
    for (const t of PROFILE_THEMES) {
      expect(t.logo).toBe(`/brand/aurora/${t.key}`);
      for (const f of ["icone.svg", "simbolo.svg", "favicon.svg"]) expect(existsSync(`public${t.logo}/${f}`), `${t.key}/${f}`).toBe(true);
    }
    expect(readdirSync("public/brand/aurora").sort()).toEqual(["girly", "manifestacao", "padrao", "titanio"]);
  });

  it("o mesmo ícone no claro e no escuro", () => {
    for (const t of PROFILE_THEMES) {
      const url = `url(${t.logo}/icone.svg)`;
      expect(t.paleta.extras?.["--logo-tema"]).toBe(url);
      expect(t.paletaAlternativa.extras?.["--logo-tema"]).toBe(url);
    }
  });
});

describe("logo Aurora por tema", () => {
  it("cada tema aponta para a sua variante, e o arquivo existe", () => {
    for (const t of PROFILE_THEMES) {
      expect(t.logo).toBe(`/brand/aurora/${t.key}`);
      for (const f of ["icone.svg", "simbolo.svg", "favicon.svg"]) expect(existsSync(`public${t.logo}/${f}`), `${t.key}/${f}`).toBe(true);
    }
    expect(readdirSync("public/brand/aurora").sort()).toEqual(["girly", "manifestacao", "padrao", "titanio"]);
  });

  it("o mesmo ícone no claro e no escuro", () => {
    for (const t of PROFILE_THEMES) {
      const url = `url(${t.logo}/icone.svg)`;
      expect(t.paleta.extras?.["--logo-tema"]).toBe(url);
      expect(t.paletaAlternativa.extras?.["--logo-tema"]).toBe(url);
    }
  });

  it("a marca do app lê a variante pela variável do tema", () => {
    const marca = readFileSync("src/components/brand/BrandMark.tsx", "utf8");
    expect(marca).toContain("var(--logo-tema, url(/brand/aurora/padrao/icone.svg))");
  });
});

describe("migração dos temas que saíram", () => {
  it("Minimalista e Sem filtro viram Padrão; Disciplina e Game viram Titânio", () => {
    expect(CHAVES_QUE_SAIRAM).toEqual({ minimalista: "padrao", semfiltro: "padrao", disciplina: "titanio", game: "titanio" });
    expect(chaveDoTema("minimalista")).toBe("padrao");
    expect(chaveDoTema("semfiltro")).toBe("padrao");
    expect(chaveDoTema("disciplina")).toBe("titanio");
    expect(chaveDoTema("game")).toBe("titanio");
    expect(profileTheme("game").key).toBe("titanio");
  });

  it("quem tem a chave antiga não quebra: a paleta, a voz e o CSS saem do substituto", () => {
    expect(profileThemeCss("disciplina")).toBe(profileThemeCss("titanio"));
    expect(profileThemeCss("semfiltro")).toBe(profileThemeCss("padrao"));
  });

  it("as quatro chaves atuais ficam como estão; desconhecida e vazia caem no Padrão", () => {
    for (const k of ["padrao", "girly", "manifestacao", "titanio"]) expect(chaveDoTema(k)).toBe(k);
    expect(chaveDoTema("arco-iris")).toBe("padrao");
    expect(chaveDoTema("constructor")).toBe("padrao");
    expect(chaveDoTema("")).toBe("padrao");
    expect(chaveDoTema(null)).toBe("padrao");
    expect(isProfileThemeKey("titanio")).toBe(true);
    expect(isProfileThemeKey("game")).toBe(false);
  });

  it("a migração do banco faz a mesma troca que o código", () => {
    const pasta = "prisma/migrations";
    const nome = readdirSync(pasta).find((d) => d.endsWith("_quatro_temas"));
    expect(nome).toBeTruthy();
    const sql = readFileSync(`${pasta}/${nome}/migration.sql`, "utf8");
    for (const [antiga, nova] of Object.entries(CHAVES_QUE_SAIRAM)) {
      const linha = sql.split("\n").find((l) => l.startsWith("UPDATE") && l.includes(`'${antiga}'`));
      expect(linha, antiga).toContain(`SET "theme" = '${nova}'`);
    }
  });
});
