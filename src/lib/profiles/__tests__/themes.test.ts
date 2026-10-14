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
    expect(fonte("titanio")).toBe("var(--font-geist)");
    expect(profileTheme("girly").paleta.extras?.["--font-titulo"]).toBe("var(--font-cormorant)");
    expect(profileTheme("girly").paleta.extras?.["--estilo-titulo"]).toBe("italic");
    for (const k of ["padrao", "manifestacao", "titanio"]) expect(profileTheme(k).paleta.extras?.["--font-titulo"]).toBeUndefined();
    // As quatro letras são carregadas no layout raiz, dos arquivos do repositório (next/font/local).
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    for (const f of ["figtree.woff2", "hanken-grotesk.woff2", "cormorant-garamond-italic.woff2", "urbanist.woff2", "geist.woff2"]) expect(layout).toContain(f);
  });

  it("o Titânio segue a especificação: titânio com champanhe no claro, grafite C1 no escuro", () => {
    const t = profileTheme("titanio");
    expect(t.paleta.extras?.["heroi-de"]).toBe("#c9ccd1");
    expect(t.paleta.extras?.["heroi-destaque"]).toBe("#7a5a2b");
    expect(t.paleta.accent).toBe("#7a5a2b");
    expect(t.paletaAlternativa.accent).toBe("#d8bc88");
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

describe("nome da voz", () => {
  it("a voz do Titânio se chama Curto e firme; o tema continua Titânio", () => {
    const t = profileTheme("titanio");
    expect(t.label).toBe("Titânio");
    expect(t.nomeDaVoz).toBe("Curto e firme");
    // Aparece na Aparência e no gerenciador de perfis (a escolha do tema saiu do começo em 14/10/2026).
    for (const arquivo of ["src/app/(app)/configuracoes/_ajustes/EscolherEstilo.tsx", "src/components/profiles/ProfilesManager.tsx"]) {
      expect(readFileSync(arquivo, "utf8"), arquivo).toContain(".nomeDaVoz");
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

describe("o botão principal de metal do Titânio", () => {
  const titanio = profileTheme("titanio");
  const cores = (m: ModoTokens) => {
    const ex = m.extras ?? {};
    const tons = (ex["--botao-fundo"] ?? "").match(/#[0-9a-f]{6}/gi) ?? [];
    return { tinta: ex["--botao-tinta"], tons };
  };

  it("o texto passa de 4,5:1 em todos os tons do metal, no claro e no escuro", () => {
    for (const [nome, m] of [["claro", titanio.paleta], ["escuro", titanio.paletaAlternativa]] as const) {
      const { tinta, tons } = cores(m);
      expect(tinta, nome).toMatch(HEX);
      expect(tons.length, nome).toBeGreaterThanOrEqual(3);
      for (const tom of tons) expect(contraste(tinta!, tom), `${nome}: texto no ${tom}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o metal não é a cor de destaque: o champanhe fica só nos detalhes", () => {
    for (const m of [titanio.paleta, titanio.paletaAlternativa]) {
      expect(m.extras?.["--botao-fundo"]).not.toContain(m.accent);
    }
  });

  it("só o Titânio troca o botão; os outros três seguem com a cor do tema", () => {
    expect(profileThemeCss("titanio")).toContain(".bg-accent-gradient");
    for (const chave of ["padrao", "girly", "manifestacao"]) {
      expect(profileThemeCss(chave), chave).not.toContain("--botao-");
      expect(profileThemeCss(chave), chave).not.toContain(".bg-accent-gradient");
    }
  });
});

describe("o champanhe do Titânio (11/10/2026)", () => {
  const t = profileTheme("titanio");
  const modos = [["claro", t.paleta], ["escuro", t.paletaAlternativa]] as const;

  it("destaque, alerta e atenção são os combinados", () => {
    expect([t.paleta.accent, t.paleta.extras?.danger, t.paleta.extras?.atencao]).toEqual(["#7a5a2b", "#b42318", "#9a4415"]);
    expect([t.paletaAlternativa.accent, t.paletaAlternativa.extras?.danger, t.paletaAlternativa.extras?.atencao]).toEqual(["#d8bc88", "#ff8a7a", "#f0a06e"]);
  });

  it("passam no AA como texto (4,5:1) no cartão e no fundo, nos dois modos", () => {
    for (const [nome, m] of modos) {
      for (const [rotulo, cor] of [["destaque", m.accent], ["alerta", m.extras!.danger], ["atenção", m.extras!.atencao], ["destaque do herói", m.extras!["heroi-destaque"]]] as const) {
        expect(contraste(cor, m.surface), `${nome}: ${rotulo} no cartão`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor, m.canvas), `${nome}: ${rotulo} no fundo`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(m.extras!.atencao, m.extras!["atencao-fundo"]), `${nome}: atenção no selo`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.onAccent, m.accent), `${nome}: texto sobre o destaque`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o + flutuante é champanhe e o ícone passa no AA em todos os tons", () => {
    for (const [nome, m] of modos) {
      const fundo = m.extras!["--fab-fundo"];
      const tons = fundo.match(/#[0-9a-f]{6}/gi) ?? [];
      expect(tons, nome).toContain(m.accent);
      for (const tom of tons) expect(contraste(m.onAccent, tom), `${nome}: + no ${tom}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(profileThemeCss("titanio")).toContain(".botao-flutuante");
  });

  it("a Geist com dígitos tabulares vale só no Titânio", () => {
    expect(profileThemeCss("titanio")).toContain("tabular-nums");
    for (const chave of ["padrao", "girly", "manifestacao"]) expect(profileThemeCss(chave)).not.toContain("font-geist)");
  });

  it("não sobrou laranja no Titânio, nem no logo", () => {
    const laranja = /#(d9480f|c2410c|ff7a3d|ff9a66|e8894e|ffae80|b8400c|ffc6a3)/i;
    expect(profileThemeCss("titanio")).not.toMatch(laranja);
    for (const f of readdirSync("public/brand/aurora/titanio")) {
      expect(readFileSync(`public/brand/aurora/titanio/${f}`, "utf8"), f).not.toMatch(laranja);
    }
  });
});
