/**
 * Os quatro temas de personalidade: Padrão, Girly, Manifestação e Titânio (versão nova, 11/10/2026).
 *
 * Um tema é a paleta INTEIRA do app (fundo, cartão, tinta, destaque, cores das categorias) e a
 * fonte. Cada tema tem claro e escuro; quem escolhe é a pessoa, no sol/lua do topo. O escuro
 * aprovado é o "Equilibrado" (estudo-apps-financas/escuro-css/*-equilibrado.css): grafite
 * quente, tinta um pouco mais baixa e um brilho só por tela. No Titânio, o escuro é o C1:
 * grafite com brilho de metal.
 *
 * Saíram Minimalista, Disciplina, Sem filtro e Game. Quem tinha um deles cai num dos quatro
 * (ver CHAVES_QUE_SAIRAM): a migração do banco troca a chave, e o código troca de novo na
 * leitura, para nenhum perfil abrir quebrado mesmo antes da migração rodar.
 *
 * As cores vêm dos protótipos aprovados (tema-padrao.html, tema-girly.html,
 * tema-manifestacao.html e tema-titanio.html). Aqui só as essenciais são digitadas; strong, 2,
 * soft, hover e faint saem de conta, porque foi digitando derivada à mão que já nasceu um
 * hexadecimal corrompido neste projeto.
 */

export type ProfileThemeKey = "padrao" | "girly" | "manifestacao" | "titanio";

/**
 * Os temas que saíram e para onde cada perfil vai. Minimalista e Sem filtro eram claros e
 * sóbrios ou debochados: viram Padrão. Disciplina e Game eram escuros e de cobrança: viram
 * Titânio, o tema escuro e firme dos quatro.
 */
export const CHAVES_QUE_SAIRAM: Readonly<Record<string, ProfileThemeKey>> = {
  minimalista: "padrao",
  semfiltro: "padrao",
  disciplina: "titanio",
  game: "titanio",
};

/** O que cada tema declara. O resto da paleta é calculado. */
type ModoBase = {
  canvas: string;
  surface: string;
  /** Trilho de barra, chip, campo: o degrau entre o cartão e o fundo. */
  surface2: string;
  /** Sempre rgba(), porque precisa deixar o fundo passar por baixo. */
  border: string;
  ink: string;
  inkMuted: string;
  accent: string;
  /** Tinta que fica POR CIMA do destaque (botão preenchido). */
  onAccent: string;
  /** O "strong" (links, número em destaque). Um tema pode fixar o seu; senão sai por conta. */
  accentStrong?: string;
  /**
   * Variáveis além da paleta base: cor de cada categoria, dos gráficos, do verde/vermelho, do
   * herói. Chaves sem o prefixo `--color-`. Chave que já começa com `--` sai como está (fonte,
   * fundo e forma dos ícones).
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
  /** Uma linha, em português claro, para a pessoa escolher sem precisar abrir cada um. */
  descricao: string;
  /** O modo com que o tema se apresenta na escolha (todos nascem claros). */
  modo: Modo;
  /** A paleta clara. */
  paleta: ModoTokens;
  /** A paleta escura (todos os temas têm as duas desde a versão nova). */
  paletaAlternativa: ModoTokens;
  /** Pasta do logo Aurora do tema, em /public. O mesmo ícone no claro e no escuro. */
  logo: string;
  /**
   * O nome do jeito de falar, quando a voz tem nome próprio para a usuária (Aparência e listas
   * de estilo). O tema continua com o nome dele: no Titânio, a voz se chama "Curto e firme".
   */
  nomeDaVoz?: string;
  /**
   * Regras a mais que só existem com este tema ativo (vão junto do CSS da paleta). O Titânio usa
   * para o botão principal de metal; os outros temas não têm nada aqui.
   */
  cssExtra?: string;
};

/* ---------------------------------------------------------------------------------------
   Conta de cor. Tudo em sRGB simples: o olho não precisa de mais que isso para um realce.
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

/** Sobe a opacidade de um rgba() já escrito: a borda forte é a mesma cor, mais presente. */
function maisOpaco(rgba: string, fator: number): string {
  return rgba.replace(/([\d.]+)\s*\)$/, (_, a: string) => `${Math.min(1, Number(a) * fator).toFixed(2)})`);
}

function suave(hex: string, alfa: number): string {
  return `rgba(${canais(hex).join(", ")}, ${alfa})`;
}

function montar(base: ModoBase, escuro: boolean): ModoTokens {
  const puxarParaOFundo = (cor: string, quanto: number) => misturar(cor, base.canvas, quanto);
  const puxarParaATinta = (cor: string, quanto: number) => misturar(cor, base.ink, quanto);
  return {
    ...base,
    surfaceHover: escuro ? puxarParaATinta(base.surface2, 0.08) : puxarParaATinta(base.surface2, 0.06),
    borderStrong: maisOpaco(base.border, 1.85),
    // Tinta fraca é a apagada puxada para o fundo: some no escuro, clareia no claro, sozinha.
    inkFaint: puxarParaOFundo(base.inkMuted, 0.2),
    accentStrong: base.accentStrong ?? (escuro ? puxarParaOFundo(base.accent, 0.14) : misturar(base.accent, "#000000", 0.2)),
    accent2: escuro ? misturar(base.accent, "#ffffff", 0.24) : misturar(base.accent, "#ffffff", 0.18),
    accentSoft: suave(base.accent, escuro ? 0.16 : 0.13),
  };
}

/**
 * A família de cores das categorias de um tema (rodada 13: "uma família só"), espalhada por
 * todo lugar que pinta categoria: as oito categorias-mãe, as fatias extras dos gráficos, as
 * categorias criadas pela pessoa e as classes da Estratégia da carteira.
 */
type Familia = {
  moradia: string; alimentacao: string; transporte: string; saude: string;
  lazer: string; educacao: string; impostos: string; outros: string;
};

function daFamilia(f: Familia): Record<string, string> {
  const lista = [f.moradia, f.alimentacao, f.transporte, f.saude, f.lazer, f.educacao, f.impostos, f.outros];
  return {
    "cat-moradia": f.moradia, "cat-alimentacao": f.alimentacao, "cat-transporte": f.transporte, "cat-saude": f.saude,
    "cat-lazer": f.lazer, "cat-educacao": f.educacao, "cat-impostos": f.impostos, "cat-outros": f.outros,
    "chart-5": f.lazer, "chart-6": f.educacao, "chart-7": f.outros,
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`custom-${i + 1}`, lista[(i + 1) % lista.length]])),
    "strat-pos": f.moradia, "strat-ipca": f.saude, "strat-pre": f.educacao, "strat-acoes": f.alimentacao,
    "strat-fiis": f.transporte, "strat-exterior": f.lazer, "strat-outros": f.outros,
  };
}

/** As cores do dinheiro e de estado, com a versão suave (fundo de selo) já calculada. */
function sinais(s: { success: string; danger: string; info: string; neutro: string }, escuro: boolean): Record<string, string> {
  const a = escuro ? 0.16 : 0.12;
  return {
    success: s.success, "success-soft": suave(s.success, a),
    danger: s.danger, "danger-soft": suave(s.danger, a),
    info: s.info, "info-soft": suave(s.info, a),
    "accent-neutral": s.neutro, "accent-neutral-2": s.info, "accent-neutral-soft": suave(s.neutro, a),
  };
}

const FONTES = {
  padrao: { "--font-tema": "var(--font-figtree)" },
  girly: { "--font-tema": "var(--font-hanken)", "--font-titulo": "var(--font-cormorant)", "--estilo-titulo": "italic", "--peso-titulo": "500", "--titulo-topo": "25px" },
  manifestacao: { "--font-tema": "var(--font-urbanist)" },
  titanio: { "--font-tema": "var(--font-geist)" },
} as const;

/* ------------------------------------------------------------------ Padrão (Figtree) */

const PADRAO_CLARO: ModoBase = {
  // Papel claro, tinta grafite e o dourado do SPI virando luz.
  canvas: "#f6f5f2", surface: "#ffffff", surface2: "#efede8",
  border: "rgba(20, 20, 20, 0.10)",
  ink: "#141414", inkMuted: "#46433e", accent: "#8a500c", accentStrong: "#6e3f08", onAccent: "#ffffff",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#3d4a6b", "dinheiro-gastou": "#c97f52", "dinheiro-guardou": "#8a500c", "dinheiro-sobrou": "#3d7a4f", "dinheiro-faltou": "#b7791f",
    ...FONTES.padrao,
    ...daFamilia({ moradia: "#466296", alimentacao: "#ba5434", transporte: "#267680", saude: "#408060", lazer: "#b07814", educacao: "#7056a8", impostos: "#78746c", outros: "#b24870" }),
    ...sinais({ success: "#3d7a4f", danger: "#a9503b", info: "#56637f", neutro: "#8a500c" }, false),
    // O herói: um brilho dourado só, atrás do número principal.
    "heroi-de": "#f8dca2", "heroi-para": "#f3eadb", "heroi-tinta": "#141414", "heroi-suave": "rgba(20, 20, 20, 0.74)", "heroi-borda": "rgba(20, 20, 20, 0.05)", "heroi-destaque": "#141414",
    pill: "#ffffff", "on-pill": "#141414", "tab-active": "#141414", "tab-active-soft": "rgba(20, 20, 20, 0.06)",
    "brand-a": "#f2b544", "brand-b": "#8a500c", "brand-bg": "#141414",
    "--heroi-fundo": "radial-gradient(85% 90% at 88% 0%, #f6cd7e 0%, rgba(246, 205, 126, 0.55) 38%, rgba(246, 205, 126, 0) 72%), linear-gradient(165deg, #f8e3bd 0%, #f3eadb 60%, #ecebe8 100%)",
  },
};
const PADRAO_ESCURO: ModoBase = {
  // Escuro Equilibrado: grafite quente, tinta um degrau abaixo, o âmbar queimado como luz.
  canvas: "#100e0c", surface: "#191714", surface2: "#22201d",
  border: "rgba(212, 207, 201, 0.10)",
  ink: "#d4cfc9", inkMuted: "#99958f", accent: "#d1aa73", onAccent: "#100e0c",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#8e9ab5", "dinheiro-gastou": "#c98a63", "dinheiro-guardou": "#d1aa73", "dinheiro-sobrou": "#8fb79c", "dinheiro-faltou": "#b7791f",
    ...FONTES.padrao,
    ...daFamilia({ moradia: "#a18863", alimentacao: "#967466", transporte: "#858669", saude: "#a49781", lazer: "#747e8d", educacao: "#837d76", impostos: "#7d7974", outros: "#8c867b" }),
    ...sinais({ success: "#8fb79c", danger: "#ca9186", info: "#7f8695", neutro: "#a88b5e" }, true),
    "heroi-de": "#2a2219", "heroi-para": "#1c1916", "heroi-tinta": "#d4cfc9", "heroi-suave": "#99958f", "heroi-borda": "rgba(212, 207, 201, 0.06)", "heroi-destaque": "#d1aa73",
    pill: "#2d2b28", "on-pill": "#d4cfc9", "tab-active": "#d1aa73", "tab-active-soft": "rgba(209, 170, 115, 0.12)",
    "brand-a": "#f2b544", "brand-b": "#a88b5e", "brand-bg": "#22201d",
    "--heroi-fundo": "radial-gradient(70% 70% at 100% 0%, rgba(209, 170, 115, 0.10), rgba(209, 170, 115, 0) 70%), #1c1916",
  },
};

/* -------------------------------------------- Girly (Hanken Grotesk + Cormorant itálica) */

const GIRLY_CLARO: ModoBase = {
  // Blush e champanhe, como cosmético caro. Um ponto de luz por tela, o resto neutro e quente.
  canvas: "#faf5f3", surface: "#ffffff", surface2: "#f3e9e6",
  border: "rgba(30, 21, 23, 0.10)",
  ink: "#1e1517", inkMuted: "#4d3e42", accent: "#9c3d5c", accentStrong: "#7a2b47", onAccent: "#ffffff",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#3e7a5e", "dinheiro-gastou": "#c08a6a", "dinheiro-guardou": "#9c3d5c", "dinheiro-sobrou": "#6e68a8", "dinheiro-faltou": "#b7791f",
    ...FONTES.girly,
    ...daFamilia({ moradia: "#8c6355", alimentacao: "#b0605a", transporte: "#5f8475", saude: "#b25a7d", lazer: "#9a6a9e", educacao: "#6f5486", impostos: "#7b5f9e", outros: "#9c7f4e" }),
    ...sinais({ success: "#3e7a5e", danger: "#8c2632", info: "#6e68a8", neutro: "#9c3d5c" }, false),
    "heroi-de": "#f2c4d0", "heroi-para": "#ece0f0", "heroi-tinta": "#150e10", "heroi-suave": "#3d2e32", "heroi-borda": "rgba(156, 61, 92, 0.10)", "heroi-destaque": "#150e10",
    pill: "#ffffff", "on-pill": "#7a2b47", "tab-active": "#9c3d5c", "tab-active-soft": "rgba(156, 61, 92, 0.10)",
    "brand-a": "#f2c4d0", "brand-b": "#9c3d5c", "brand-bg": "#faf5f3",
    "--heroi-fundo": "radial-gradient(38% 40% at 34% 34%, rgba(255, 251, 248, 0.9), rgba(255, 251, 248, 0) 100%), radial-gradient(48% 52% at 82% 24%, #e3d2ee, rgba(227, 210, 238, 0) 100%), radial-gradient(52% 56% at 76% 86%, #edd3be, rgba(237, 211, 190, 0) 100%), radial-gradient(56% 60% at 14% 84%, #f2c4d0, rgba(242, 196, 208, 0) 100%), #f5dce1",
  },
};
const GIRLY_ESCURO: ModoBase = {
  canvas: "#130c0f", surface: "#1c1518", surface2: "#261e21",
  border: "rgba(219, 203, 209, 0.10)",
  ink: "#dbcbd1", inkMuted: "#a29198", accent: "#c89dac", onAccent: "#130c0f",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#8cc7a8", "dinheiro-gastou": "#d9a88e", "dinheiro-guardou": "#e0a2b8", "dinheiro-sobrou": "#a29bc0", "dinheiro-faltou": "#b7791f",
    ...FONTES.girly,
    ...daFamilia({ moradia: "#978078", alimentacao: "#9e7a73", transporte: "#7e9289", saude: "#a27e8c", lazer: "#97829a", educacao: "#897f9c", impostos: "#8d87a5", outros: "#9f9079" }),
    ...sinais({ success: "#92b4a0", danger: "#ce949c", info: "#8d87a5", neutro: "#a98792" }, true),
    "heroi-de": "#2b1c22", "heroi-para": "#21171b", "heroi-tinta": "#dbcbd1", "heroi-suave": "#a29198", "heroi-borda": "rgba(219, 203, 209, 0.06)", "heroi-destaque": "#c89dac",
    pill: "#31292c", "on-pill": "#dbcbd1", "tab-active": "#c89dac", "tab-active-soft": "rgba(200, 157, 172, 0.12)",
    "brand-a": "#f2c4d0", "brand-b": "#c89dac", "brand-bg": "#261e21",
    "--heroi-fundo": "radial-gradient(70% 70% at 100% 0%, rgba(200, 157, 172, 0.08), rgba(200, 157, 172, 0) 70%), #21171b",
  },
};

/* ---------------------------------------------------------------- Manifestação (Urbanist) */

const MANIFESTACAO_CLARO: ModoBase = {
  // Névoa no topo, como um céu de fim de tarde: lavanda, pêssego e azul bem diluídos.
  canvas: "#f5f4f8", surface: "#ffffff", surface2: "#eceaf3",
  border: "rgba(25, 24, 38, 0.10)",
  ink: "#191826", inkMuted: "#3a3757", accent: "#5b4fa8", accentStrong: "#463a94", onAccent: "#ffffff",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#4a6fa6", "dinheiro-gastou": "#b86e98", "dinheiro-guardou": "#463a94", "dinheiro-sobrou": "#2f7a6e", "dinheiro-faltou": "#b7791f",
    ...FONTES.manifestacao,
    ...daFamilia({ moradia: "#6e5fc7", alimentacao: "#a8618f", transporte: "#55779f", saude: "#b8708f", lazer: "#7d7999", educacao: "#3f4a9e", impostos: "#4b7c9c", outros: "#8a73c2" }),
    ...sinais({ success: "#1e5f57", danger: "#8a2d47", info: "#5a7db0", neutro: "#8780c2" }, false),
    "heroi-de": "#e2dcf6", "heroi-para": "#f7e5dc", "heroi-tinta": "#191826", "heroi-suave": "#3a3757", "heroi-borda": "rgba(25, 24, 38, 0.06)", "heroi-destaque": "#191826",
    pill: "#ffffff", "on-pill": "#191826", "tab-active": "#463a94", "tab-active-soft": "rgba(70, 58, 148, 0.10)",
    "brand-a": "#c4bbff", "brand-b": "#5b4fa8", "brand-bg": "#f5f4f8",
    "--heroi-fundo": "radial-gradient(60% 65% at 12% 8%, #ded9f7, rgba(222, 217, 247, 0) 72%), radial-gradient(60% 60% at 92% 18%, #f8dfd1, rgba(248, 223, 209, 0) 72%), radial-gradient(75% 70% at 55% 105%, #d9e6f4, rgba(217, 230, 244, 0) 72%), #f2eff7",
  },
};
const MANIFESTACAO_ESCURO: ModoBase = {
  canvas: "#0c0d1a", surface: "#151624", surface2: "#1e1f2e",
  border: "rgba(205, 207, 221, 0.10)",
  ink: "#cdcfdd", inkMuted: "#9395a5", accent: "#aaa3da", onAccent: "#0c0d1a",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#9fb9e3", "dinheiro-gastou": "#e2a6c6", "dinheiro-guardou": "#c4bbff", "dinheiro-sobrou": "#8bbaaf", "dinheiro-faltou": "#b7791f",
    ...FONTES.manifestacao,
    ...daFamilia({ moradia: "#827ca7", alimentacao: "#9c7e93", transporte: "#7887a1", saude: "#a78895", lazer: "#858397", educacao: "#73789e", impostos: "#788e9d", outros: "#9088ab" }),
    ...sinais({ success: "#8bbaaf", danger: "#d09aaa", info: "#7f8ea8", neutro: "#958fba" }, true),
    "heroi-de": "#1f1d38", "heroi-para": "#17182a", "heroi-tinta": "#cdcfdd", "heroi-suave": "#9395a5", "heroi-borda": "rgba(205, 207, 221, 0.06)", "heroi-destaque": "#aaa3da",
    pill: "#262838", "on-pill": "#cdcfdd", "tab-active": "#aaa3da", "tab-active-soft": "rgba(170, 163, 218, 0.12)",
    "brand-a": "#c4bbff", "brand-b": "#aaa3da", "brand-bg": "#1e1f2e",
    "--heroi-fundo": "radial-gradient(60% 60% at 100% 0%, rgba(170, 163, 218, 0.08), rgba(170, 163, 218, 0) 70%), #17182a",
  },
};

/* --------------------------------------------------------------------- Titânio (Geist) */

const TITANIO_CLARO: ModoBase = {
  // Titânio escovado (#C9CCD1) com o champanhe #7A5A2B só nos detalhes (era laranja até 11/10/2026).
  canvas: "#efefee", surface: "#ffffff", surface2: "#e5e5e3",
  border: "rgba(17, 18, 20, 0.10)",
  ink: "#111214", inkMuted: "#3c3e43", accent: "#7a5a2b", accentStrong: "#5f4520", onAccent: "#ffffff",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#2f4058", "dinheiro-gastou": "#a8844c", "dinheiro-guardou": "#5c4320", "dinheiro-sobrou": "#2f6b4a", "dinheiro-faltou": "#b7791f",
    ...FONTES.titanio,
    ...daFamilia({ moradia: "#7a5a2b", alimentacao: "#4d5f7a", transporte: "#4f8a68", saude: "#6e7a88", lazer: "#b8955a", educacao: "#2a2c30", impostos: "#9c7a45", outros: "#8c8f94" }),
    ...sinais({ success: "#2f6b4a", danger: "#b42318", info: "#4d5f7a", neutro: "#7a5a2b" }, false),
    "heroi-de": "#c9ccd1", "heroi-para": "#f1f2f3", "heroi-tinta": "#111214", "heroi-suave": "#3c3e43", "heroi-borda": "rgba(0, 0, 0, 0.06)", "heroi-destaque": "#7a5a2b",
    pill: "#ffffff", "on-pill": "#111214", "tab-active": "#7a5a2b", "tab-active-soft": "rgba(122, 90, 43, 0.10)",
    "brand-a": "#b8955a", "brand-b": "#7a5a2b", "brand-bg": "#111214",
    // A atenção vira cobre: o âmbar sumia perto do champanhe.
    atencao: "#9a4415", "atencao-fundo": "#f6e3d6",
    "--heroi-fundo": "linear-gradient(135deg, #e9eaec 0%, #c9ccd1 38%, #f1f2f3 55%, #b9bdc3 100%)",
    "--fundo-tema": "radial-gradient(120% 70% at 50% -10%, #f7f7f6 0%, #efefee 55%, #e6e7e8 100%)",
    // O botão principal com o mesmo brilho liso do cartão herói (11/10/2026: sem listras de
    // escova, pedido da Dani), e um fio de luz no alto. Texto #111214: 9,9:1 no tom mais escuro.
    "--botao-fundo": "linear-gradient(135deg, #e9eaec 0%, #c9ccd1 38%, #f1f2f3 55%, #b9bdc3 100%)",
    "--botao-tinta": "#111214",
    "--botao-fio": "inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 0 0 1px rgba(17, 18, 20, 0.16), 0 6px 16px -6px rgba(17, 18, 20, 0.28)",
    // O + flutuante em champanhe com o reflexo do herói no alto (o ícone branco fica no tom #7a5a2b: 6,4:1).
    "--fab-fundo": "radial-gradient(70% 55% at 30% 12%, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0) 70%), linear-gradient(135deg, #8c6a37 0%, #7a5a2b 45%, #6a4e24 100%)",
    "--fab-fio": "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08), 0 14px 28px -10px rgba(122, 90, 43, 0.55)",
  },
};
const TITANIO_ESCURO: ModoBase = {
  // Escuro C1: grafite (#1B1D21 a #141518) com brilho de metal, herói #2A2D33 a #3A3E46.
  canvas: "#16171a", surface: "#1f2125", surface2: "#2a2d32",
  border: "rgba(255, 255, 255, 0.10)",
  ink: "#f3efe8", inkMuted: "#cfc8bd", accent: "#d8bc88", onAccent: "#141518",
  extras: {
    // As cores do dinheiro (rodada 58): Entrou, Gastou, Guardou e Sobrou, iguais no app todo.
    "dinheiro-entrou": "#a7b6cc", "dinheiro-gastou": "#c9a46a", "dinheiro-guardou": "#ecdcbc", "dinheiro-sobrou": "#8ccba4", "dinheiro-faltou": "#b7791f",
    ...FONTES.titanio,
    ...daFamilia({ moradia: "#d8bc88", alimentacao: "#a7b6cc", transporte: "#8ccba4", saude: "#c4cbd6", lazer: "#ecd9b2", educacao: "#7e8188", impostos: "#b89463", outros: "#b6b8bc" }),
    ...sinais({ success: "#8ccba4", danger: "#ff8a7a", info: "#a7b6cc", neutro: "#d8bc88" }, true),
    "heroi-de": "#3a3e46", "heroi-para": "#2a2d33", "heroi-tinta": "#f6f2ec", "heroi-suave": "#d6cfc4", "heroi-borda": "rgba(255, 255, 255, 0.12)", "heroi-destaque": "#d8bc88",
    pill: "#30333a", "on-pill": "#f3efe8", "tab-active": "#d8bc88", "tab-active-soft": "rgba(216, 188, 136, 0.14)",
    "brand-a": "#e6d3ac", "brand-b": "#d8bc88", "brand-bg": "#2a2d33",
    atencao: "#f0a06e", "atencao-fundo": "#33231a",
    "--heroi-fundo": "linear-gradient(118deg, #23262b 0%, #2a2d33 22%, #3a3e46 40%, #5a5f68 47%, #3a3e46 54%, #2a2d33 72%, #23262b 100%)",
    "--fundo-tema": "radial-gradient(130% 80% at 50% -10%, #26282d 0%, #1b1d21 45%, #141518 100%)",
    // O brilho de metal dos cartões: uma faixa de reflexo diagonal e um fio de luz no topo.
    "--cartao-brilho": "linear-gradient(115deg, #1e2024 0%, #25282e 36%, #2e3238 46%, #25282d 56%, #1c1e22 100%)",
    "--cartao-fio": "inset 0 1px 0 rgba(255, 255, 255, 0.11)",
    // O botão principal com o reflexo do cartão herói escuro, liso. Texto #f3efe8: 5,6:1 no reflexo.
    "--botao-fundo": "linear-gradient(118deg, #23262b 0%, #2a2d33 22%, #3a3e46 40%, #5a5f68 47%, #3a3e46 54%, #2a2d33 72%, #23262b 100%)",
    "--botao-tinta": "#f3efe8",
    "--botao-fio": "inset 0 1px 0 rgba(255, 255, 255, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 18px -8px rgba(0, 0, 0, 0.6)",
    // O + flutuante em champanhe com reflexo no alto; o ícone #141518 passa de 7:1 em todo o degradê.
    "--fab-fundo": "radial-gradient(70% 55% at 30% 12%, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 70%), linear-gradient(135deg, #e6d3ac 0%, #d8bc88 45%, #b89a64 100%)",
    "--fab-fio": "inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2), 0 14px 28px -10px rgba(216, 188, 136, 0.35)",
  },
};

/**
 * O botão principal do Titânio: o brilho do cartão herói no lugar do laranja (pedido da Dani, 11/10/2026). Vale para
 * todo botão primário (`bg-accent-gradient` com `text-on-accent`). O + da Visão geral
 * (`botao-flutuante`) é champanhe com um reflexo liso no alto, longe do ícone.
 */
const TITANIO_BOTAO = `
html .bg-accent-gradient {
  background: var(--botao-fundo);
  box-shadow: var(--botao-fio);
}
html .bg-accent-gradient.text-on-accent, html .bg-accent-gradient .text-on-accent {
  color: var(--botao-tinta);
}
html body {
  font-variant-numeric: tabular-nums;
}
html .botao-flutuante {
  background: var(--fab-fundo);
  box-shadow: var(--fab-fio);
}`;

function tema(key: ProfileThemeKey, label: string, descricao: string, claro: ModoBase, escuro: ModoBase): ProfileTheme {
  const logo = `/brand/aurora/${key}`;
  // O mesmo logo nos dois modos (decisão da versão nova): a variável vai igual nos dois blocos.
  const comLogo = (b: ModoBase): ModoBase => ({ ...b, extras: { ...b.extras, "--logo-tema": `url(${logo}/icone.svg)` } });
  return { key, label, descricao, modo: "claro", paleta: montar(comLogo(claro), false), paletaAlternativa: montar(comLogo(escuro), true), logo };
}

export const PROFILE_THEMES: ProfileTheme[] = [
  tema("padrao", "Padrão", "Papel claro, tinta grafite e o dourado do SPI. Sóbrio e direto ao ponto.", PADRAO_CLARO, PADRAO_ESCURO),
  tema("girly", "Girly", "Blush e champanhe. Te chama de amiga e comemora junto.", GIRLY_CLARO, GIRLY_ESCURO),
  tema("manifestacao", "Manifestação", "Lavanda e céu de fim de tarde. Liga cada real à vida que você quer.", MANIFESTACAO_CLARO, MANIFESTACAO_ESCURO),
  { ...tema("titanio", "Titânio", "Metal escovado com champanhe nos detalhes. Calmo, adulto e com os pés no chão.", TITANIO_CLARO, TITANIO_ESCURO), nomeDaVoz: "Curto e firme", cssExtra: TITANIO_BOTAO },
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = "padrao";

const PELA_CHAVE = new Map(PROFILE_THEMES.map((t) => [t.key, t]));

/**
 * A chave de tema que vale para uma chave guardada no banco. Tema que saiu vai para o
 * substituto dele; chave desconhecida (ou vazia) cai no Padrão. Nunca devolve chave inválida.
 */
export function chaveDoTema(key: string | null | undefined): ProfileThemeKey {
  if (key && PELA_CHAVE.has(key as ProfileThemeKey)) return key as ProfileThemeKey;
  if (key && Object.hasOwn(CHAVES_QUE_SAIRAM, key)) return CHAVES_QUE_SAIRAM[key];
  return DEFAULT_PROFILE_THEME;
}

/** Tema guardado no banco pode ter vindo de outra versão: cai no substituto ou no Padrão. */
export function profileTheme(key: string | null | undefined): ProfileTheme {
  return PELA_CHAVE.get(chaveDoTema(key))!;
}

export function isProfileThemeKey(value: unknown): value is ProfileThemeKey {
  return typeof value === "string" && PELA_CHAVE.has(value as ProfileThemeKey);
}

/** A preferência de modo guardada na conta: claro, escuro ou o do celular. */
export type PreferenciaDeModo = "light" | "dark" | "auto";

export function preferenciaDeModo(valor: string | null | undefined): PreferenciaDeModo {
  return valor === "dark" || valor === "auto" ? valor : "light";
}

/**
 * O modo que vale quando o servidor precisa decidir: o que a pessoa escolheu. No Automático o
 * servidor não sabe o modo do celular; o claro é o palpite, e o script de antes da primeira
 * pintura corrige no aparelho.
 */
export function modoEfetivo(themeKey: string | null | undefined, preferenciaDaPessoa: string | null | undefined): Modo {
  void themeKey;
  return preferenciaDeModo(preferenciaDaPessoa) === "dark" ? "escuro" : "claro";
}

/** Todos os temas têm claro e escuro desde a versão nova: o sol/lua aparece sempre. */
export function temaDeixaEscolherModo(themeKey?: string | null): boolean {
  void themeKey;
  return true;
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
 * - `html.light:root` (0,2,1) ganha do `html.light` (0,1,1) do globals.css.
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
  return `html:not(.light) {${bloco(t.paletaAlternativa)}
}
html.light:root {${bloco(t.paleta)}
}${t.cssExtra ?? ""}`;
}
