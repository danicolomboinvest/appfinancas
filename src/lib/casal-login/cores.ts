import { PROFILE_THEMES, profileTheme, type ModoTokens } from "@/lib/profiles/themes";

/**
 * As cores das duas pessoas do casal (bolinha, ponto, barra e anel), por tema e modo.
 *
 * - Quem paga o Casal fica com o destaque do tema (no Titânio, o champanhe; nunca laranja).
 * - O par fica com um azul acinzentado que combina com os quatro destaques: escuro no claro e
 *   claro no escuro, como o "Entrou" do Titânio.
 * - A letra dentro da bolinha é a tinta (clara ou escura) que dá mais contraste, sempre AA (4,5:1):
 *   o destaque claro do escuro (champanhe, rosa) pede letra escura.
 *
 * Vai como variáveis CSS (--casal-*), junto do CSS do tema; os componentes leem com reserva, então
 * fora do app (sem tema) as cores de antes continuam valendo.
 */

const PAR_NO_CLARO = "#4a6382";
const PAR_NO_ESCURO = "#a7b6cc";
const TINTA_CLARA = "#ffffff";
const TINTA_ESCURA = "#141518";

function canais(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function tintaPara(fundo: string): string {
  return contraste(fundo, TINTA_CLARA) >= contraste(fundo, TINTA_ESCURA) ? TINTA_CLARA : TINTA_ESCURA;
}

export type CoresDoCasal = { titular: string; titularTinta: string; par: string; parTinta: string };

export function coresDoModo(m: ModoTokens, escuro: boolean): CoresDoCasal {
  // No escuro, o destaque (mais claro) é o que aparece como cor do tema; no claro, o destaque forte.
  const titular = escuro ? m.accent : m.accentStrong;
  const par = escuro ? PAR_NO_ESCURO : PAR_NO_CLARO;
  return { titular, titularTinta: tintaPara(titular), par, parTinta: tintaPara(par) };
}

function bloco(c: CoresDoCasal): string {
  return `--casal-titular: ${c.titular}; --casal-titular-tinta: ${c.titularTinta}; --casal-par: ${c.par}; --casal-par-tinta: ${c.parTinta};`;
}

export function coresDoCasalCss(tema: string | null | undefined): string {
  const t = profileTheme(tema);
  return `html:not(.light) { ${bloco(coresDoModo(t.paletaAlternativa, true))} }
html.light:root { ${bloco(coresDoModo(t.paleta, false))} }`;
}

/** Todas as combinações tema × modo, para o teste de contraste. */
export function todasAsCores(): { tema: string; escuro: boolean; cores: CoresDoCasal }[] {
  return PROFILE_THEMES.flatMap((t) => [
    { tema: t.key, escuro: false, cores: coresDoModo(t.paleta, false) },
    { tema: t.key, escuro: true, cores: coresDoModo(t.paletaAlternativa, true) },
  ]);
}
