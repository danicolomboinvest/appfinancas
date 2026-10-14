import { describe, expect, it } from "vitest";
import { PROFILE_THEMES, type ModoTokens } from "@/lib/profiles/themes";

/**
 * As 3 cores do bloco principal do Resumo novo (globals.css, .resumo-a/b/c) passam no AA em
 * todos os temas, claro e escuro: texto normal 4,5:1; o número grande e as linhas, 3:1.
 */
const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, pa: number) => {
  const x = canais(a);
  const y = canais(b);
  return `#${x.map((v, i) => Math.round(v * pa + y[i] * (1 - pa)).toString(16).padStart(2, "0")).join("")}`;
};
const lum = (hex: string) => {
  const [r, g, b] = canais(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const extra = (m: ModoTokens, k: string) => m.extras?.[k] as string;
const hex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

const casos = PROFILE_THEMES.flatMap((t) => [
  { nome: `${t.label} claro`, m: t.paleta, escuro: false },
  { nome: `${t.label} escuro`, m: t.paletaAlternativa, escuro: true },
]);

describe.each(casos)("Resumo novo, cores do bloco principal: $nome", ({ m, escuro }) => {
  it("(b) cheio na cor de destaque: texto e texto suave com 4,5:1", () => {
    expect(contraste(m.onAccent, m.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(mix(m.onAccent, m.accent, 0.86), m.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("(c) fundo neutro: o número na cor de destaque com 4,5:1, o texto suave também", () => {
    const numero = escuro ? m.accent : m.accentStrong;
    expect(contraste(numero, m.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(m.inkMuted, m.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("(a) o herói de hoje: o texto com 4,5:1 nas duas pontas do degradê, a linha com 3:1", () => {
    const linha = escuro ? m.accent : m.accentStrong;
    for (const fundo of [extra(m, "heroi-de"), extra(m, "heroi-para")].filter(hex)) {
      expect(contraste(extra(m, "heroi-tinta"), fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(linha, fundo)).toBeGreaterThanOrEqual(3);
    }
  });
});
