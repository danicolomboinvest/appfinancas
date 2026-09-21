/**
 * As cores que um perfil pode ter.
 *
 * O app inteiro já pinta seus destaques com `var(--color-accent)` e companhia. Então a cor do
 * perfil não precisa tocar em nenhum componente: basta redefinir essas cinco variáveis no
 * elemento que envolve a aplicação. É também o que impede o pedido de virar bagunça — a cor
 * entra em botão, progresso, ícone e gráfico, e o fundo continua neutro.
 *
 * Cada cor tem duas versões porque o tema decide o contraste: no escuro o destaque é a nota
 * clara sobre fundo fundo; no claro é o inverso, e o texto sobre ele fica branco. É a mesma
 * regra que o dourado da marca já seguia.
 *
 * Todas são cores fechadas, meio dessaturadas, de propósito: nada de néon, que é o que faz um
 * app financeiro parecer brinquedo.
 */

export type ProfileColorKey =
  | "ambar"
  | "verde"
  | "azul"
  | "petroleo"
  | "roxo"
  | "vinho"
  | "terracota"
  | "rosa"
  | "grafite";

type Tokens = {
  accent: string;
  accentStrong: string;
  accent2: string;
  /** Canal RGB da cor, pra montar o `soft` com transparência. */
  rgb: string;
  onAccent: string;
};

export type ProfileColor = {
  key: ProfileColorKey;
  label: string;
  dark: Tokens;
  light: Tokens;
};

export const PROFILE_COLORS: ProfileColor[] = [
  {
    key: "ambar",
    label: "Dourado",
    dark: { accent: "#e0b24e", accentStrong: "#cfa03f", accent2: "#f0cd7d", rgb: "224, 178, 78", onAccent: "#1a1405" },
    light: { accent: "#a9781f", accentStrong: "#855c12", accent2: "#c9962f", rgb: "169, 120, 31", onAccent: "#ffffff" },
  },
  {
    key: "verde",
    label: "Verde",
    dark: { accent: "#6fae87", accentStrong: "#5d9a75", accent2: "#93c8a6", rgb: "111, 174, 135", onAccent: "#0b1710" },
    light: { accent: "#2f6b48", accentStrong: "#235337", accent2: "#3f855b", rgb: "47, 107, 72", onAccent: "#ffffff" },
  },
  {
    key: "azul",
    label: "Azul",
    dark: { accent: "#7aa2d6", accentStrong: "#6890c4", accent2: "#a0c0e6", rgb: "122, 162, 214", onAccent: "#0a1220" },
    light: { accent: "#2e5c92", accentStrong: "#23486f", accent2: "#3d74b4", rgb: "46, 92, 146", onAccent: "#ffffff" },
  },
  {
    key: "petroleo",
    label: "Azul petróleo",
    dark: { accent: "#5f9ea4", accentStrong: "#4f8a90", accent2: "#84bdc2", rgb: "95, 158, 164", onAccent: "#071617" },
    light: { accent: "#1f5f66", accentStrong: "#174a50", accent2: "#2c7c85", rgb: "31, 95, 102", onAccent: "#ffffff" },
  },
  {
    key: "roxo",
    label: "Roxo",
    dark: { accent: "#9b87c4", accentStrong: "#8873b2", accent2: "#b8a8d9", rgb: "155, 135, 196", onAccent: "#120c1c" },
    light: { accent: "#5a4383", accentStrong: "#453265", accent2: "#7358a3", rgb: "90, 67, 131", onAccent: "#ffffff" },
  },
  {
    key: "vinho",
    label: "Vinho",
    dark: { accent: "#b66f79", accentStrong: "#a05a63", accent2: "#cc949c", rgb: "182, 111, 121", onAccent: "#1a0c0f" },
    light: { accent: "#7a2f3a", accentStrong: "#5f242d", accent2: "#9c4350", rgb: "122, 47, 58", onAccent: "#ffffff" },
  },
  {
    key: "terracota",
    label: "Terracota",
    dark: { accent: "#c68a6a", accentStrong: "#b2775a", accent2: "#dcab90", rgb: "198, 138, 106", onAccent: "#1b0f08" },
    light: { accent: "#8c4a2a", accentStrong: "#6e3820", accent2: "#a9603b", rgb: "140, 74, 42", onAccent: "#ffffff" },
  },
  {
    key: "rosa",
    label: "Rosa queimado",
    dark: { accent: "#c78c95", accentStrong: "#b37a83", accent2: "#dfb0b7", rgb: "199, 140, 149", onAccent: "#1c0e11" },
    light: { accent: "#8d4a56", accentStrong: "#6f3944", accent2: "#a96370", rgb: "141, 74, 86", onAccent: "#ffffff" },
  },
  {
    key: "grafite",
    label: "Grafite",
    dark: { accent: "#9aa0a6", accentStrong: "#868c92", accent2: "#bcc1c6", rgb: "154, 160, 166", onAccent: "#101112" },
    light: { accent: "#4a5056", accentStrong: "#383d42", accent2: "#646b72", rgb: "74, 80, 86", onAccent: "#ffffff" },
  },
];

export const DEFAULT_PROFILE_COLOR: ProfileColorKey = "ambar";

const PELA_CHAVE = new Map(PROFILE_COLORS.map((c) => [c.key, c]));

/** Cor guardada no banco pode ter vindo de uma versão anterior: cai no dourado em vez de quebrar. */
export function profileColor(key: string | null | undefined): ProfileColor {
  return PELA_CHAVE.get(key as ProfileColorKey) ?? PELA_CHAVE.get(DEFAULT_PROFILE_COLOR)!;
}

export function isProfileColorKey(value: unknown): value is ProfileColorKey {
  return typeof value === "string" && PELA_CHAVE.has(value as ProfileColorKey);
}

/**
 * O CSS que troca a cor de destaque da aplicação inteira.
 *
 * Sai como `<style>` no servidor, e não como estilo inline no elemento, porque precisa cobrir
 * os dois temas: qual conjunto vale depende do tema que a pessoa escolheu, e isso é decidido
 * pelo mesmo seletor que o resto do app já usa.
 */
export function profileColorCss(key: string | null | undefined, escopo = "[data-profile-accent]"): string {
  const c = profileColor(key);
  const bloco = (t: Tokens) => `
  --color-accent: ${t.accent};
  --color-accent-strong: ${t.accentStrong};
  --color-accent-2: ${t.accent2};
  --color-accent-soft: rgba(${t.rgb}, 0.15);
  --color-on-accent: ${t.onAccent};`;
  // Mesma cascata do globals.css: escuro é o padrão, claro entra por data-theme ou preferência.
  return `${escopo} {${bloco(c.dark)}
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) ${escopo} {${bloco(c.light)}
  }
}
:root[data-theme="light"] ${escopo} {${bloco(c.light)}
}`;
}
