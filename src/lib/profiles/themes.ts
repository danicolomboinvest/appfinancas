/**
 * Os sete temas de personalidade.
 *
 * Um tema é a paleta INTEIRA do app — fundo, cartão, tinta e destaque — e não só a cor de
 * realce. Isso é de propósito: quando o tema era só a cor, a Dani apontou que dava na mesma,
 * porque a pessoa já escolhia a cor do perfil. O que separa Girly de Minimalista é o fundo
 * branco contra o quase-preto, a tinta vinho contra a cinza, não um botão rosa.
 *
 * O que um tema NÃO muda: a fonte (Albert Sans), os cantos arredondados, a disposição da tela.
 * Entrou/Gastou/Guardado está no mesmo lugar nos sete. Foi condição dela, e é o que impede o
 * recurso de virar sete apps diferentes pra manter.
 *
 * Cada tema tem UM modo, o dele. Girly é branco; Disciplina é preto. Foi assim que a Dani
 * aprovou no canvas, e a primeira versão daqui — que inventou um Girly escuro e um Game claro
 * e ainda ligava o escuro por padrão — foi o que ela rejeitou ("a versão escura ficou ruim").
 * Só o Padrão tem claro e escuro, porque já tinha antes dos temas e gente usa os dois. O
 * sol/lua continua existindo pra ele; pros outros seis, o tema decide.
 *
 * As cores vieram dos desenhos aprovados (canvas "Temas SPI Finance"). Aqui só as essenciais
 * são digitadas; strong, 2, soft, hover e faint saem de conta, porque foi digitando derivada
 * à mão que já nasceu um hexadecimal corrompido neste projeto.
 */

export type ProfileThemeKey =
  | "padrao"
  | "girly"
  | "minimalista"
  | "disciplina"
  | "semfiltro"
  | "game"
  | "manifestacao";

/** O que cada tema declara. O resto da paleta é calculado. */
type ModoBase = {
  canvas: string;
  surface: string;
  /** Trilho de barra, chip, campo — o degrau entre o cartão e o fundo. */
  surface2: string;
  /** Sempre rgba(), porque precisa deixar o fundo passar por baixo. */
  border: string;
  ink: string;
  inkMuted: string;
  accent: string;
  /** Tinta que fica POR CIMA do destaque (botão preenchido). */
  onAccent: string;
  /**
   * O "strong" (número do Aportou, links) sai por conta escurecendo o destaque. Um tema pode
   * fixar o seu: no Girly, escurecer 20% virava vinho — e vinho foi o que a Dani não gostou.
   */
  accentStrong?: string;
  /**
   * Variáveis além da paleta base: cor de cada categoria, dos gráficos, do verde/vermelho.
   * Só quem precisa declara. O Girly precisa: a Dani pediu os gráficos em tons de rosa, e as
   * oito cores de categoria do globals.css (roxo, laranja, azul...) são justamente o que
   * quebrava a essência. Chaves sem o prefixo `--color-`. Chave que já começa com `--` sai
   * como está — é assim que entram as variáveis de forma dos ícones (`--icon-radius` etc.).
   */
  extras?: Record<string, string>;
};

export type ModoTokens = ModoBase & {
  surfaceHover: string;
  borderStrong: string;
  inkFaint: string;
  accentStrong: string;
  accent2: string;
  accentSoft: string;
};

export type Modo = "escuro" | "claro";

export type ProfileTheme = {
  key: ProfileThemeKey;
  label: string;
  /** Uma linha, em português claro, pra pessoa escolher sem precisar abrir cada um. */
  descricao: string;
  /** O modo nativo: a cara que o tema tem. */
  modo: Modo;
  /** A paleta do modo nativo. */
  paleta: ModoTokens;
  /** Só o Padrão: a paleta do OUTRO modo, pra quem usa o sol/lua. Nos demais é undefined. */
  paletaAlternativa?: ModoTokens;
};

/* ---------------------------------------------------------------------------------------
   Conta de cor. Tudo em sRGB simples — o olho não precisa de mais que isso pra um realce.
   --------------------------------------------------------------------------------------- */

function canais(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function paraHex([r, g, b]: [number, number, number]): string {
  const dois = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${dois(r)}${dois(g)}${dois(b)}`;
}

/** Mistura `cor` com `alvo` na proporção dada (0 = cor intacta, 1 = alvo puro). */
function misturar(cor: string, alvo: string, quanto: number): string {
  const a = canais(cor);
  const b = canais(alvo);
  return paraHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * quanto) as [number, number, number]);
}

/** Sobe a opacidade de um rgba() já escrito — a borda forte é a mesma cor, mais presente. */
function maisOpaco(rgba: string, fator: number): string {
  return rgba.replace(/([\d.]+)\s*\)$/, (_, a: string) => `${Math.min(1, Number(a) * fator).toFixed(2)})`);
}

function montar(base: ModoBase, escuro: boolean): ModoTokens {
  // No escuro o realce claro clareia pra virar "2" e escurece pra virar "strong"; no claro é
  // a mesma lógica, só que o strong é o que aprofunda o contraste contra o papel branco.
  const puxarParaOFundo = (cor: string, quanto: number) => misturar(cor, base.canvas, quanto);
  const puxarParaATinta = (cor: string, quanto: number) => misturar(cor, base.ink, quanto);
  return {
    ...base,
    surfaceHover: escuro ? puxarParaATinta(base.surface2, 0.08) : puxarParaATinta(base.surface2, 0.06),
    borderStrong: maisOpaco(base.border, 1.85),
    // Tinta fraca é a apagada puxada pro fundo: some no escuro, clareia no claro, sozinha.
    inkFaint: puxarParaOFundo(base.inkMuted, 0.2),
    accentStrong: base.accentStrong ?? (escuro ? puxarParaOFundo(base.accent, 0.14) : misturar(base.accent, "#000000", 0.2)),
    accent2: escuro ? misturar(base.accent, "#ffffff", 0.24) : misturar(base.accent, "#ffffff", 0.18),
    accentSoft: `rgba(${canais(base.accent).join(", ")}, ${escuro ? "0.16" : "0.13"})`,
  };
}

function tema(key: ProfileThemeKey, label: string, descricao: string, modo: Modo, base: ModoBase): ProfileTheme {
  return { key, label, descricao, modo, paleta: montar(base, modo === "escuro") };
}

const PADRAO_ESCURO: ModoBase = {
  canvas: "#0a0908", surface: "#141210", surface2: "#1e1b17",
  border: "rgba(240, 228, 200, 0.10)",
  ink: "#f3efe6", inkMuted: "#9b968b", accent: "#e0b24e", onAccent: "#1a1405",
};
const PADRAO_CLARO: ModoBase = {
  canvas: "#ffffff", surface: "#ffffff", surface2: "#f4f1ea",
  border: "rgba(26, 24, 21, 0.13)",
  ink: "#121212", inkMuted: "#555555", accent: "#a9781f", onAccent: "#ffffff",
};

export const PROFILE_THEMES: ProfileTheme[] = [
  {
    ...tema("padrao", "Padrão", "O app como ele é hoje: dourado, sóbrio, direto ao ponto.", "escuro", PADRAO_ESCURO),
    paletaAlternativa: montar(PADRAO_CLARO, false),
  },
  tema("girly", "Girly", "Branco e rosa. Te chama de amiga, comemora junto e os gráficos são em tons de rosa.", "claro", {
    // Calibrado nas referências que a Dani mandou (planilha rosa e o painel de hábitos):
    // NÃO é rosa-choque. É framboesa empoeirada de destaque, blush pastel de preenchimento e
    // texto cinza-escuro — duas ou três profundidades do MESMO rosa, nada neon. O #d81b73 da
    // versão anterior era magenta de néon, e foi o que ela não amou.
    canvas: "#fbf5f7", surface: "#ffffff", surface2: "#fde3ec",
    border: "rgba(197, 61, 116, 0.14)",
    // #c53d74: rosa de verdade, mais claro que o framboesa anterior (que ela achou vinho),
    // ainda com 4,9:1 pro texto branco. O strong é fixo em vez de calculado, senão vira vinho.
    ink: "#2b2226", inkMuted: "#7a6670", accent: "#c53d74", onAccent: "#ffffff", accentStrong: "#b8336a",
    extras: {
      "tab-active": "#c53d74", "tab-active-soft": "rgba(197, 61, 116, 0.12)",
      // Uma escala do mesmo rosa por categoria, do framboesa ao blush. Varia em profundidade,
      // não em matiz, como nas referências: a rosca continua legível e continua rosa.
      "cat-moradia": "#a8335a",
      "cat-alimentacao": "#d15b8c",
      "cat-transporte": "#c2456f",
      "cat-saude": "#e693b5",
      "cat-lazer": "#e07fa8",
      "cat-educacao": "#b56a86",
      "cat-impostos": "#8c2a4c",
      "cat-outros": "#f0c1d4",
      "chart-5": "#c9789a",
      "chart-6": "#a8335a",
      "chart-7": "#e6b3c6",
      "custom-1": "#b83a63", "custom-2": "#e07fa8", "custom-3": "#b56a86", "custom-4": "#e693b5", "custom-5": "#8c2a4c",
      "custom-6": "#c2456f", "custom-7": "#c9789a", "custom-8": "#d15b8c", "custom-9": "#e6b3c6", "custom-10": "#a8335a",
      // Entrou/Gastou continuam verde e vermelho (é significado), mas jade e rosa-vermelho,
      // que convivem com o blush sem gritar.
      "success": "#2a8a6a", "success-soft": "rgba(42, 138, 106, 0.12)",
      // O vermelho do Gastou era quase o rosa do Aportou, um do lado do outro. Este é mais
      // vermelho e menos rosa, de propósito, pra Gastou e Aportou não parecerem a mesma cor.
      "danger": "#d94452", "danger-soft": "rgba(217, 68, 82, 0.12)",
      "info": "#c9789a", "info-soft": "rgba(201, 120, 154, 0.13)",
      "accent-neutral": "#c9789a", "accent-neutral-2": "#e6b3c6", "accent-neutral-soft": "rgba(201, 120, 154, 0.14)",
      // A pílula ativa das abas em rosa, não em preto.
      "pill": "#c53d74", "on-pill": "#ffffff",
      // A marca: o sol âmbar sobre quadrado escuro vira sol rosa sobre blush.
      "brand-a": "#f7b8d0", "brand-b": "#c53d74", "brand-bg": "#fde3ec",
      // As classes da carteira (renda fixa, ações, FIIs…) na mesma escala de rosa.
      "strat-pos": "#c53d74", "strat-ipca": "#e07fa8", "strat-pre": "#b56a86", "strat-acoes": "#a8335a",
      "strat-fiis": "#e693b5", "strat-exterior": "#d15b8c", "strat-outros": "#f0c1d4",
    },
  }),
  tema("minimalista", "Minimalista", "Branco, preto e cinza. Só o número, sem enfeite nenhum.", "claro", {
    canvas: "#f7f7f5", surface: "#ffffff", surface2: "#efefed",
    border: "rgba(25, 25, 25, 0.10)",
    ink: "#191919", inkMuted: "#75746f", accent: "#191919", onAccent: "#ffffff",
    extras: {
      // Ícone só de contorno, quadrado arredondado, tinta preta: linha, não mancha.
      "--icon-radius": "10px",
      "--icon-fill": "0%",
      "--icon-border-width": "1.5px",
      "--icon-ink": "var(--color-ink)",
      // Preto, branco e cinza até nos gráficos: a rosca vira uma escala de cinzas.
      "brand-a": "#f5f5f3", "brand-b": "#9a9a94", "brand-bg": "#191919",
      "cat-moradia": "#191919", "cat-alimentacao": "#4a4a47", "cat-transporte": "#6b6b67", "cat-saude": "#8a8a85",
      "cat-lazer": "#a6a6a1", "cat-educacao": "#c2c2bd", "cat-impostos": "#333331", "cat-outros": "#d9d9d5",
      "chart-5": "#7a7a75", "chart-6": "#5a5a56", "chart-7": "#bdbdb8",
      "custom-1": "#191919", "custom-2": "#6b6b67", "custom-3": "#a6a6a1", "custom-4": "#4a4a47", "custom-5": "#c2c2bd",
      "custom-6": "#333331", "custom-7": "#8a8a85", "custom-8": "#d9d9d5", "custom-9": "#5a5a56", "custom-10": "#7a7a75",
      "strat-pos": "#191919", "strat-ipca": "#6b6b67", "strat-pre": "#a6a6a1", "strat-acoes": "#4a4a47",
      "strat-fiis": "#8a8a85", "strat-exterior": "#333331", "strat-outros": "#d9d9d5",
      "info": "#5a5a56", "info-soft": "rgba(90, 90, 86, 0.12)",
      "accent-neutral": "#4a4a47", "accent-neutral-2": "#8a8a85", "accent-neutral-soft": "rgba(74, 74, 71, 0.12)",
    },
  }),
  tema("disciplina", "Disciplina", "Laranja sobre preto. Te cobra pelo número, nunca por quem você é.", "escuro", {
    canvas: "#0b0d0e", surface: "#13171a", surface2: "#1b2125",
    border: "rgba(255, 255, 255, 0.10)",
    ink: "#eef4f5", inkMuted: "#8a9aa0", accent: "#d17111", onAccent: "#1a0c00",
    extras: {
      "tab-active": "#f0954a", "tab-active-soft": "rgba(209, 113, 17, 0.18)",
      // Tudo em laranja-âmbar, do queimado ao claro. Ícone em quadrado arredondado: firme.
      "cat-moradia": "#d17111", "cat-alimentacao": "#f0954a", "cat-transporte": "#a85a0a", "cat-saude": "#ffb877",
      "cat-lazer": "#e8a15c", "cat-educacao": "#c2410c", "cat-impostos": "#8a4a10", "cat-outros": "#f5cba0",
      "chart-5": "#e07a2e", "chart-6": "#b46418", "chart-7": "#f3c08a",
      "custom-1": "#d17111", "custom-2": "#f0954a", "custom-3": "#a85a0a", "custom-4": "#ffb877", "custom-5": "#c2410c",
      "custom-6": "#e8a15c", "custom-7": "#8a4a10", "custom-8": "#f5cba0", "custom-9": "#e07a2e", "custom-10": "#b46418",
      "strat-pos": "#d17111", "strat-ipca": "#f0954a", "strat-pre": "#a85a0a", "strat-acoes": "#c2410c",
      "strat-fiis": "#ffb877", "strat-exterior": "#e8a15c", "strat-outros": "#f5cba0",
      "info": "#f0954a", "info-soft": "rgba(240, 149, 74, 0.14)",
      "accent-neutral": "#e07a2e", "accent-neutral-2": "#ffb877", "accent-neutral-soft": "rgba(224, 122, 46, 0.14)",
      "--icon-radius": "10px",
      // A marca: sol laranja sobre preto frio.
      "brand-a": "#f0954a", "brand-b": "#d17111", "brand-bg": "#13171a",
    },
  }),
  tema("semfiltro", "Sem filtro", "Claro e coral, debochado. Fala a verdade sem passar a mão na cabeça.", "claro", {
    canvas: "#fdfbfa", surface: "#ffffff", surface2: "#ffe3e3",
    border: "rgba(32, 28, 26, 0.11)",
    ink: "#201c1a", inkMuted: "#6b625e", accent: "#d63a3f", onAccent: "#ffffff",
    extras: {
      "tab-active": "#d63a3f", "tab-active-soft": "rgba(214, 58, 63, 0.12)",
      // Coral e quentes. Categoria vira emoji (ver icones.ts), num círculo coral-claro.
      "cat-moradia": "#d63a3f", "cat-alimentacao": "#ff7a7e", "cat-transporte": "#a82a2e", "cat-saude": "#ffb3b6",
      "cat-lazer": "#ff9a6b", "cat-educacao": "#e8555a", "cat-impostos": "#8e1f22", "cat-outros": "#ffd0c2",
      "chart-5": "#f06a5e", "chart-6": "#c43a3f", "chart-7": "#ffc2b8",
      "custom-1": "#d63a3f", "custom-2": "#ff7a7e", "custom-3": "#a82a2e", "custom-4": "#ffb3b6", "custom-5": "#e8555a",
      "custom-6": "#ff9a6b", "custom-7": "#8e1f22", "custom-8": "#ffd0c2", "custom-9": "#f06a5e", "custom-10": "#c43a3f",
      "strat-pos": "#d63a3f", "strat-ipca": "#ff7a7e", "strat-pre": "#a82a2e", "strat-acoes": "#e8555a",
      "strat-fiis": "#ffb3b6", "strat-exterior": "#ff9a6b", "strat-outros": "#ffd0c2",
      "info": "#f06a5e", "info-soft": "rgba(240, 106, 94, 0.13)",
      "accent-neutral": "#e8555a", "accent-neutral-2": "#ffb3b6", "accent-neutral-soft": "rgba(232, 85, 90, 0.13)",
      "brand-a": "#ffb3b6", "brand-b": "#d63a3f", "brand-bg": "#201c1a",
    },
  }),
  tema("game", "Game", "Azul-marinho e ciano, ranqueada de e-sport: divisão, temporada e conquista.", "escuro", {
    canvas: "#0a1428", surface: "#101f3a", surface2: "#17294a",
    border: "rgba(180, 210, 255, 0.12)",
    ink: "#e8f1ff", inkMuted: "#8ba3cf", accent: "#16d3c2", onAccent: "#04211f",
    extras: {
      "tab-active": "#16d3c2", "tab-active-soft": "rgba(22, 211, 194, 0.16)",
      // Ciano e azuis, com brilho: o ícone tem um halo da própria cor, como um botão de HUD.
      "cat-moradia": "#16d3c2", "cat-alimentacao": "#4fa8ff", "cat-transporte": "#0f9e93", "cat-saude": "#8ad6ff",
      "cat-lazer": "#2f6bff", "cat-educacao": "#7fe9de", "cat-impostos": "#1b6fa8", "cat-outros": "#b9f0ea",
      "chart-5": "#3aa0d8", "chart-6": "#1489a3", "chart-7": "#a3d9ff",
      "custom-1": "#16d3c2", "custom-2": "#4fa8ff", "custom-3": "#0f9e93", "custom-4": "#8ad6ff", "custom-5": "#2f6bff",
      "custom-6": "#7fe9de", "custom-7": "#1b6fa8", "custom-8": "#b9f0ea", "custom-9": "#3aa0d8", "custom-10": "#1489a3",
      "strat-pos": "#16d3c2", "strat-ipca": "#4fa8ff", "strat-pre": "#0f9e93", "strat-acoes": "#2f6bff",
      "strat-fiis": "#8ad6ff", "strat-exterior": "#7fe9de", "strat-outros": "#b9f0ea",
      "info": "#4fa8ff", "info-soft": "rgba(79, 168, 255, 0.14)",
      "accent-neutral": "#3aa0d8", "accent-neutral-2": "#8ad6ff", "accent-neutral-soft": "rgba(58, 160, 216, 0.14)",
      "--icon-radius": "12px",
      "--icon-glow": "0 0 14px color-mix(in srgb, var(--cat) 55%, transparent)",
      "brand-a": "#7fe9de", "brand-b": "#16d3c2", "brand-bg": "#101f3a",
    },
  }),
  tema("manifestacao", "Manifestação", "Claro e lilás, aspiracional. Liga cada real à vida que você quer.", "claro", {
    canvas: "#faf7fb", surface: "#ffffff", surface2: "#ece3f1",
    border: "rgba(90, 60, 110, 0.12)",
    ink: "#2b2130", inkMuted: "#6f6377", accent: "#7b5ea7", onAccent: "#ffffff",
    extras: {
      "tab-active": "#7b5ea7", "tab-active-soft": "rgba(123, 94, 167, 0.12)",
      // Lilás do escuro ao claro, e o ícone ganha um brilho suave em cima, como vidro.
      "cat-moradia": "#7b5ea7", "cat-alimentacao": "#a98bd4", "cat-transporte": "#5a4383", "cat-saude": "#cdb6e4",
      "cat-lazer": "#8f6fb8", "cat-educacao": "#b79ae0", "cat-impostos": "#4b3a6e", "cat-outros": "#e2d4f0",
      "chart-5": "#9c7fc4", "chart-6": "#6a4f95", "chart-7": "#d8c8ea",
      "custom-1": "#7b5ea7", "custom-2": "#a98bd4", "custom-3": "#5a4383", "custom-4": "#cdb6e4", "custom-5": "#8f6fb8",
      "custom-6": "#b79ae0", "custom-7": "#4b3a6e", "custom-8": "#e2d4f0", "custom-9": "#9c7fc4", "custom-10": "#6a4f95",
      "strat-pos": "#7b5ea7", "strat-ipca": "#a98bd4", "strat-pre": "#5a4383", "strat-acoes": "#8f6fb8",
      "strat-fiis": "#cdb6e4", "strat-exterior": "#b79ae0", "strat-outros": "#e2d4f0",
      "info": "#9c7fc4", "info-soft": "rgba(156, 127, 196, 0.13)",
      "accent-neutral": "#8f6fb8", "accent-neutral-2": "#cdb6e4", "accent-neutral-soft": "rgba(143, 111, 184, 0.13)",
      "--icon-overlay": "linear-gradient(160deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 60%)",
      "brand-a": "#cdb6e4", "brand-b": "#7b5ea7", "brand-bg": "#2b2130",
    },
  }),
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = "padrao";

const PELA_CHAVE = new Map(PROFILE_THEMES.map((t) => [t.key, t]));

/** Tema guardado no banco pode ter vindo de outra versão: cai no Padrão em vez de quebrar. */
export function profileTheme(key: string | null | undefined): ProfileTheme {
  return PELA_CHAVE.get(key as ProfileThemeKey) ?? PELA_CHAVE.get(DEFAULT_PROFILE_THEME)!;
}

export function isProfileThemeKey(value: unknown): value is ProfileThemeKey {
  return typeof value === "string" && PELA_CHAVE.has(value as ProfileThemeKey);
}

/**
 * O modo (claro/escuro) que vale de verdade: o do tema, quando o tema tem um só; o que a pessoa
 * escolheu no sol/lua, quando o tema deixa (hoje, só o Padrão).
 */
export function modoEfetivo(themeKey: string | null | undefined, preferenciaDaPessoa: string): Modo {
  const t = profileTheme(themeKey);
  if (!t.paletaAlternativa) return t.modo;
  return preferenciaDaPessoa === "light" ? "claro" : "escuro";
}

/** O tema deixa a pessoa escolher claro/escuro? Decide se o sol/lua aparece. */
export function temaDeixaEscolherModo(themeKey: string | null | undefined): boolean {
  return Boolean(profileTheme(themeKey).paletaAlternativa);
}

/**
 * O CSS que troca a paleta da aplicação inteira.
 *
 * Vai no <html>, e não num <div> por dentro, porque o `body` também pinta com
 * `var(--color-canvas)`: com o tema preso num invólucro, a cor antiga vazava nas bordas e no
 * repique da rolagem.
 *
 * Os seletores são estranhos de propósito, e é por causa de peso:
 * - `html:not(.light)` (0,1,1) ganha do `:root` (0,1,0) do globals.css, que é o modo escuro.
 * - `html.light:root` (0,2,1) ganha do `html.light` (0,1,1) do globals.css. Só `html.light`
 *   empataria, e aí passaria a depender de qual folha o navegador leu por último — o tipo de
 *   coisa que funciona no teste e quebra no ar.
 *
 * Tema de modo único põe a MESMA paleta nos dois blocos. Assim, mesmo que o script anti-flash
 * ponha a classe errada por um instante (ele lê a preferência antiga do localStorage), a tela
 * nasce na cor certa e não pisca.
 */
export function profileThemeCss(key: string | null | undefined): string {
  const t = profileTheme(key);
  const bloco = (m: ModoTokens) => `
  --color-canvas: ${m.canvas};
  --color-surface: ${m.surface};
  --color-surface-2: ${m.surface2};
  --color-surface-hover: ${m.surfaceHover};
  --color-border: ${m.border};
  --color-border-strong: ${m.borderStrong};
  --color-ink: ${m.ink};
  --color-ink-muted: ${m.inkMuted};
  --color-ink-faint: ${m.inkFaint};
  --color-accent: ${m.accent};
  --color-accent-strong: ${m.accentStrong};
  --color-accent-2: ${m.accent2};
  --color-accent-soft: ${m.accentSoft};
  --color-on-accent: ${m.onAccent};${Object.entries(m.extras ?? {}).map(([k, v]) => `\n  ${k.startsWith("--") ? k : `--color-${k}`}: ${v};`).join("")}`;
  const escura = t.modo === "escuro" ? t.paleta : (t.paletaAlternativa ?? t.paleta);
  const clara = t.modo === "claro" ? t.paleta : (t.paletaAlternativa ?? t.paleta);
  return `html:not(.light) {${bloco(escura)}
}
html.light:root {${bloco(clara)}
}`;
}
