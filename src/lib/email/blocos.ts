import { DEFAULT_CURRENCY, currencySymbol, formatMoney, type CurrencyCode } from "@/lib/money";
import { chaveDoTema, profileTheme, type ModoTokens, type ProfileThemeKey } from "@/lib/profiles/themes";

/**
 * Os blocos dos e-mails do SPI Finance na direção B, "Aurora" (proposta de 11/10/2026, aprovada
 * pela dona para todos os e-mails): o degradê do herói do tema com o logo no topo, o número
 * grande e leve com a moeda pequena, e o resto em cartões empilhados.
 *
 * Regras de e-mail que tudo aqui segue:
 *  - Layout só com <table>, estilo inline, 600 px no máximo e fluido abaixo disso (bom a 390).
 *  - Nada de JavaScript nem SVG (o Gmail não mostra SVG): logo e ícones são PNG em
 *    public/email/, com endereço completo.
 *  - Gráfico e barra são células de tabela com largura, altura e cor.
 *  - Cores do tema da pessoa (lib/profiles/themes.ts), nunca hexadecimal copiado. As claras vão
 *    inline; as escuras entram por classe num <style> com prefers-color-scheme (Apple Mail, iOS,
 *    Outlook) e [data-ogsc]/[data-ogsb] (Outlook.com). O Gmail ignora o bloco e faz a inversão
 *    dele; o desenho aguenta porque todo número é texto.
 *  - No Outlook do Windows o canto fica reto e o degradê vira a cor lisa do bgcolor.
 *  - Sem emoji e sem travessão no texto (é a voz dela). O teste confere.
 *
 * Quem monta o e-mail escapa o que a pessoa digitou (escaparHtml) antes de passar para cá: os
 * blocos recebem HTML pronto.
 */

/** Onde ficam os PNG. Fixo no domínio de produção: o endereço de prévia da Vercel pede login. */
export const URL_DAS_IMAGENS = `${(process.env.EMAIL_ASSETS_URL ?? "https://financas.danicolombo.com.br").replace(/\/+$/, "")}/email`;

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const T0 = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

/** As categorias que têm ícone desenhado (os nomes dos PNG). As outras ganham um ponto na cor. */
const ICONES_DE_CATEGORIA = new Set(["moradia", "alimentacao", "transporte", "saude", "lazer", "educacao", "impostos", "outros"]);
export type IconeDoEmail = "cartao" | "conta" | "meta" | "trofeu" | "voz";

/**
 * Texto que a pessoa digitou (nome, nome de perfil, de categoria, de meta) não pode virar HTML
 * dentro do e-mail. O cadastro não confirmava o e-mail: alguém se cadastrava com o endereço de
 * uma aluna e punha no nome um link de golpe, que chegava pra ela saindo do remetente do app.
 */
export function escaparHtml(texto: string): string {
  return texto.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
}

/**
 * Assunto de e-mail: sem emoji, sem travessão e com a primeira letra maiúscula (o convite do
 * Girly saía "outubro começou, bora organizar?").
 */
export function assunto(texto: string): string {
  const limpo = texto
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

/** "setembro de 2026" vira "Setembro de 2026". */
export function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/* ------------------------------------------------------------------ cores do tema no e-mail */

function canais(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function misturar(cor: string, alvo: string, quanto: number): string {
  const a = canais(cor);
  const b = canais(alvo);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * quanto).toString(16).padStart(2, "0")).join("")}`;
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const CATEGORIAS = ["moradia", "alimentacao", "transporte", "saude", "lazer", "educacao", "impostos", "outros"] as const;

/** Os nomes de cor que os blocos usam. Um nome, duas cores: a clara e a escura do tema. */
export type Tom =
  | "canvas" | "surface" | "surface2" | "ink" | "muted" | "line"
  | "accent" | "accentTint" | "botao" | "onBotao"
  | "success" | "successTint" | "danger" | "dangerTint"
  | "heroDe" | "heroPara"
  | "entrou" | "gastou" | "entrouSoft" | "gastouSoft"
  | (typeof CATEGORIAS)[number] | `${(typeof CATEGORIAS)[number]}Tint`;

export type Cores = Record<Tom, string>;

function coresDoModo(m: ModoTokens, escuro: boolean): Cores {
  const x = m.extras ?? {};
  const fundo = m.surface;
  const tint = (c: string) => misturar(c, fundo, escuro ? 0.78 : 0.88);
  const botao = x["tab-active"] ?? m.accent;
  const success = x.success ?? "#3d7a4f";
  const danger = x.danger ?? "#a9503b";
  const base = {
    canvas: m.canvas,
    surface: m.surface,
    surface2: m.surface2,
    ink: m.ink,
    muted: m.inkMuted,
    line: misturar(m.ink, m.surface, 0.9),
    accent: m.accent,
    accentTint: tint(m.accent),
    botao,
    // Tinta do botão pelo contraste: grafite e vinho levam branco; o âmbar do escuro, a cor do fundo.
    onBotao: luminancia(botao) > 0.4 ? (escuro ? m.canvas : "#111111") : "#ffffff",
    success,
    successTint: tint(success),
    danger,
    dangerTint: tint(danger),
    heroDe: x["heroi-de"] ?? m.surface2,
    heroPara: x["heroi-para"] ?? m.surface,
    entrou: success,
    gastou: m.accent,
    entrouSoft: misturar(success, fundo, 0.55),
    gastouSoft: misturar(m.accent, fundo, 0.55),
  } as Partial<Cores>;
  for (const c of CATEGORIAS) {
    const cor = x[`cat-${c}`] ?? m.accent;
    base[c] = cor;
    base[`${c}Tint`] = tint(cor);
  }
  return base as Cores;
}

/** As duas paletas do e-mail de um tema: a clara (inline) e a escura (no bloco de estilo). */
export function coresDoEmail(tema: string | null | undefined): { key: ProfileThemeKey; claro: Cores; escuro: Cores } {
  const t = profileTheme(tema);
  return { key: t.key, claro: coresDoModo(t.paleta, false), escuro: coresDoModo(t.paletaAlternativa, true) };
}

/* ------------------------------------------------------------------ os blocos */

export type Cartao = string;

/**
 * Os blocos de um e-mail, presos ao tema e à moeda da pessoa. Cada e-mail cria os seus:
 * `const b = criarBlocos(tema, moeda)`.
 */
export function criarBlocos(tema: string | null | undefined, moeda: CurrencyCode = DEFAULT_CURRENCY) {
  const { key, claro: L, escuro: D } = coresDoEmail(chaveDoTema(tema));
  const simbolo = currencySymbol(moeda);

  /** class + style (+ bgcolor) de um elemento com fundo, cor ou borda do tema. */
  function sx(tons: { bg?: Tom; c?: Tom; bd?: Tom }, extra = ""): string {
    const classes: string[] = [];
    let estilo = "";
    let attr = "";
    if (tons.bg) {
      classes.push(`bg-${tons.bg}`);
      estilo += `background-color:${L[tons.bg]};`;
      attr += ` bgcolor="${L[tons.bg]}"`;
    }
    if (tons.c) {
      classes.push(`c-${tons.c}`);
      estilo += `color:${L[tons.c]};`;
    }
    if (tons.bd) {
      classes.push(`bd-${tons.bd}`);
      estilo += `border-color:${L[tons.bd]};`;
    }
    return `${classes.length ? ` class="${classes.join(" ")}"` : ""}${attr} style="${estilo}${extra}"`;
  }

  /** O número sem a moeda, sem sinal, arredondado: 2741 vira "2.741". */
  const numero = (v: number) => formatMoney(Math.round(Math.abs(v)), moeda, { round: true, bare: true });
  /** "R$&nbsp;2.741", para o meio de uma frase em HTML. */
  const R = (v: number) => `${simbolo}&nbsp;${numero(v)}`;
  /** "R$ 2.741", para assunto e texto puro. */
  const Rtexto = (v: number) => `${simbolo} ${numero(v)}`;

  /** Número grande e leve com a moeda pequena (o jeito Apple Card do app). */
  function valor(v: number, tam = 56, cor: Tom = "ink"): string {
    return `<span${sx({ c: "muted" }, `font-size:${Math.round(tam * 0.36)}px;font-weight:400;letter-spacing:0;`)}>${simbolo}</span><span class="c-${cor} num-${tam}" style="color:${L[cor]};font-size:${tam}px;font-weight:300;letter-spacing:-0.035em;font-variant-numeric:tabular-nums;">&nbsp;${numero(v)}</span>`;
  }

  const alinhar = (centro: boolean) => (centro ? "text-align:center;" : "");

  function eyebrow(txt: string, centro = false): string {
    return `<div${sx({ c: "muted" }, `font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;${alinhar(centro)}`)}>${txt}</div>`;
  }

  const espaco = (h: number) => `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
  const texto = (t: string, extra = "") => `<div${sx({ c: "ink" }, `font-size:16px;line-height:24px;${extra}`)}>${t}</div>`;
  const suave = (t: string, extra = "") => `<div${sx({ c: "muted" }, `font-size:15px;line-height:22px;${extra}`)}>${t}</div>`;
  const pequeno = (t: string, extra = "") => `<div${sx({ c: "muted" }, `font-size:13px;line-height:19px;${extra}`)}>${t}</div>`;
  const titulo = (t: string, tam = 24, extra = "") =>
    `<div${sx({ c: "ink" }, `font-size:${tam}px;line-height:${Math.round(tam * 1.22)}px;font-weight:600;letter-spacing:-0.02em;${extra}`)}>${t}</div>`;
  /** Um pedaço de texto colorido no meio de uma frase ("<b>12% menos</b>"). */
  const destaque = (t: string, cor: Tom) => `<b${sx({ c: cor }, "font-weight:600;")}>${t}</b>`;
  const link = (href: string, t: string, cor: Tom = "ink") => `<a href="${href}" target="_blank"${sx({ c: cor }, "text-decoration:underline;")}>${t}</a>`;

  /** Linha de cartão com respiro dos lados (o `px` encolhe no celular). */
  const pad = (inner: string, p = "26px 28px") => `<tr><td class="px" style="padding:${p};">${inner}</td></tr>`;

  /** Barra horizontal. `pct` de 0 a 100; `passou` (em %) desenha o pedaço acima do plano em outra cor. */
  function barra(pct: number, cor: Tom, opcoes: { alt?: number; passou?: number; trilho?: Tom } = {}): string {
    const alt = opcoes.alt ?? 10;
    const trilho = opcoes.trilho ?? "surface2";
    const r = alt / 2;
    const cel = (w: number, tom: Tom, raio: string) => `<td width="${w}%"${sx({ bg: tom }, `height:${alt}px;font-size:0;line-height:0;${raio}`)}>&nbsp;</td>`;
    const passou = opcoes.passou ?? 0;
    if (passou > 0) {
      const dentro = Math.round((100 / (100 + passou)) * 100);
      return `<table ${T0} width="100%"><tr>${cel(dentro, cor, `border-radius:${r}px 0 0 ${r}px;`)}<td width="3"${sx({ bg: "surface" }, "width:3px;font-size:0;line-height:0;")}>&nbsp;</td>${cel(100 - dentro, "danger", `border-radius:0 ${r}px ${r}px 0;`)}</tr></table>`;
    }
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    if (p >= 100) return `<table ${T0} width="100%"><tr>${cel(100, cor, `border-radius:${r}px;`)}</tr></table>`;
    if (p <= 0) return `<table ${T0} width="100%"><tr>${cel(100, trilho, `border-radius:${r}px;`)}</tr></table>`;
    return `<table ${T0} width="100%"><tr>${cel(p, cor, `border-radius:${r}px 0 0 ${r}px;`)}${cel(100 - p, trilho, `border-radius:0 ${r}px ${r}px 0;`)}</tr></table>`;
  }

  /** Legenda de duas pontas embaixo de uma barra: "R$ 417 gastos" … "plano R$ 350". */
  function legenda(esquerda: string, direita: string): string {
    return `<table ${T0} width="100%" style="margin-top:8px;"><tr><td${sx({ c: "ink" }, "font-size:13px;line-height:18px;font-weight:600;")}>${esquerda}</td><td align="right"${sx({ c: "muted" }, "font-size:13px;line-height:18px;")}>${direita}</td></tr></table>`;
  }

  /** Gráfico de barras Entrou x Gastou, uma dupla por mês; o último mês em cor cheia. */
  function grafico(meses: { rotulo: string; entrou: number; gastou: number }[], altMax = 104): string {
    const max = Math.max(1, ...meses.flatMap((m) => [m.entrou, m.gastou]));
    const larg = 12;
    const h = (v: number) => Math.max(3, Math.round((Math.max(0, v) / max) * altMax));
    const colunas = meses
      .map((m, i) => {
        const atual = i === meses.length - 1;
        const bar = (v: number, tom: Tom) =>
          `<td valign="bottom" style="padding:0 2px;"><table ${T0}><tr><td width="${larg}" height="${h(v)}"${sx({ bg: tom }, `width:${larg}px;height:${h(v)}px;border-radius:4px 4px 0 0;font-size:0;line-height:0;`)}>&nbsp;</td></tr></table></td>`;
        return `<td align="center" valign="bottom" style="padding:0;"><table ${T0} align="center"><tr>${bar(m.entrou, atual ? "entrou" : "entrouSoft")}${bar(m.gastou, atual ? "gastou" : "gastouSoft")}</tr></table><div${sx({ c: atual ? "ink" : "muted" }, `font-size:11px;line-height:14px;padding-top:6px;font-weight:${atual ? 700 : 400};`)}>${m.rotulo}</div></td>`;
      })
      .join("");
    const ponto = (tom: Tom, txt: string) =>
      `<td style="padding-right:14px;"><table ${T0}><tr><td width="8" height="8"${sx({ bg: tom }, "width:8px;height:8px;border-radius:4px;font-size:0;line-height:0;")}>&nbsp;</td><td${sx({ c: "muted" }, "font-size:12px;padding-left:6px;")}>${txt}</td></tr></table></td>`;
    return `<table ${T0} width="100%" style="height:${altMax + 24}px;"><tr>${colunas}</tr></table><table ${T0} style="margin-top:12px;"><tr>${ponto("entrou", "Entrou")}${ponto("gastou", "Gastou")}</tr></table>`;
  }

  /** Ícone num círculo. `nome` é uma categoria (moradia, saude...) ou um dos ícones do app. */
  function icone(nome: string | null, fundo: Tom, tam = 40, centro = false): string {
    const img =
      nome && (ICONES_DE_CATEGORIA.has(nome) || ["cartao", "conta", "meta", "trofeu", "voz"].includes(nome))
        ? `<img src="${URL_DAS_IMAGENS}/ic-${nome}-${key}.png" width="${Math.round(tam * 0.5)}" height="${Math.round(tam * 0.5)}" alt="" style="display:block;border:0;">`
        : `<table ${T0}><tr><td width="10" height="10"${sx({ bg: "accent" }, "width:10px;height:10px;border-radius:5px;font-size:0;line-height:0;")}>&nbsp;</td></tr></table>`;
    return `<table ${T0}${centro ? ' align="center"' : ""}><tr><td width="${tam}" height="${tam}" align="center" valign="middle"${sx({ bg: fundo }, `width:${tam}px;height:${tam}px;border-radius:${tam / 2}px;`)}>${img}</td></tr></table>`;
  }

  /** O tom da categoria (a cor dela no tema), ou o destaque para categoria criada pela pessoa. */
  function tomDaCategoria(chave: string | null): { cor: Tom; tint: Tom; icone: string | null } {
    const k = chave?.toLowerCase() ?? "";
    if ((CATEGORIAS as readonly string[]).includes(k)) return { cor: k as Tom, tint: `${k}Tint` as Tom, icone: k };
    return { cor: "accent", tint: "accentTint", icone: null };
  }

  /** Botão de pílula. `cheio` ocupa a largura; `secundario` é o de contorno. */
  function botao(href: string, txt: string, opcoes: { cheio?: boolean; secundario?: boolean } = {}): string {
    const td = opcoes.secundario
      ? sx({ bg: "surface", bd: "line" }, "border-width:1px;border-style:solid;border-radius:999px;")
      : sx({ bg: "botao" }, "border-radius:999px;");
    const estiloA = `display:block;padding:14px 26px;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;text-align:center;font-family:${FONTE};`;
    const a = sx({ c: opcoes.secundario ? "ink" : "onBotao" }, estiloA);
    return `<table ${T0}${opcoes.cheio ? ' width="100%"' : ""} style="border-collapse:separate;"><tr><td align="center"${td}><a href="${href}" target="_blank"${a}>${txt}</a></td></tr></table>`;
  }

  /** Caixa de destaque em `surface2` (a frase de exemplo, uma opção do aviso). */
  function caixa(inner: string, p = "16px 18px"): string {
    return `<table ${T0} width="100%"><tr><td${sx({ bg: "surface2" }, `border-radius:18px;padding:${p};`)}>${inner}</td></tr></table>`;
  }

  /** A frase de exemplo para falar, com o ícone do microfone. */
  function caixaDeFala(rotulo: string, frase: string): string {
    return caixa(
      `<table ${T0} width="100%"><tr><td width="52" valign="middle">${icone("voz", "accentTint", 40)}</td><td valign="middle"><div${sx({ c: "muted" }, "font-size:12px;line-height:16px;")}>${rotulo}</div><div${sx({ c: "ink" }, "font-size:17px;line-height:24px;font-weight:500;")}>${frase}</div></td></tr></table>`,
    );
  }

  /** Os três números que fecham a conta do mês, em cartõezinhos. */
  function tresNumeros(itens: { rotulo: string; valor: number; cor: Tom }[]): string {
    const cel = (i: { rotulo: string; valor: number; cor: Tom }) =>
      `<td width="33%" valign="top" style="padding:0 4px;"><table ${T0} width="100%"><tr><td${sx({ bg: "surface2" }, "border-radius:16px;padding:14px 12px;")}><div${sx({ c: "muted" }, "font-size:12px;line-height:16px;")}>${i.rotulo}</div><div${sx({ c: i.cor }, "font-size:18px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;")}><span style="font-size:12px;">${simbolo}</span>&nbsp;${numero(i.valor)}</div></td></tr></table></td>`;
    return `<table ${T0} width="100%"><tr>${itens.map(cel).join("")}</tr></table>`;
  }

  /** Linha de categoria com ícone, valor, barra contra o plano e a nota (passou, sobrou, empatou). */
  function linhaCategoria(c: { chave: string | null; nome: string; gasto: number; plano: number }): string {
    const tom = tomDaCategoria(c.chave);
    const temPlano = c.plano > 0;
    const passou = temPlano && c.gasto > c.plano;
    const nota = !temPlano
      ? "sem plano para esta categoria"
      : passou
        ? `de ${R(c.plano)} no plano, <span${sx({ c: "danger" }, "font-weight:600;")}>passou ${R(c.gasto - c.plano)}</span>`
        : Math.round(c.gasto) === Math.round(c.plano)
          ? `de ${R(c.plano)} no plano, empatou com o plano`
          : `de ${R(c.plano)} no plano, sobrou ${R(c.plano - c.gasto)}`;
    const pct = temPlano ? (c.gasto / c.plano) * 100 : 0;
    const passouPct = passou ? Math.round(((c.gasto - c.plano) / c.plano) * 100) : 0;
    return `<table ${T0} width="100%" style="margin-bottom:18px;"><tr><td width="52" valign="top" style="padding-top:2px;">${icone(tom.icone, tom.tint, 40)}</td><td valign="top"><table ${T0} width="100%"><tr><td${sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>${c.nome}</td><td align="right"${sx({ c: "ink" }, "font-size:15px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;")}>${R(c.gasto)}</td></tr></table>${espaco(8)}${barra(pct, tom.cor, { passou: passouPct })}<div${sx({ c: "muted" }, "font-size:12px;line-height:16px;padding-top:6px;")}>${nota}</div></td></tr></table>`;
  }

  /** Meta com barra de progresso. */
  function linhaMeta(m: { nome: string; guardado: number; alvo: number }): string {
    const p = m.alvo > 0 ? Math.max(0, Math.min(100, Math.round((m.guardado / m.alvo) * 100))) : 0;
    return `<table ${T0} width="100%" style="margin-bottom:8px;"><tr><td${sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>${m.nome}</td><td align="right"${sx({ c: "accent" }, "font-size:15px;line-height:20px;font-weight:600;")}>${p}%</td></tr></table>${barra(p, "accent")}<div${sx({ c: "muted" }, "font-size:12px;line-height:16px;padding-top:6px;margin-bottom:18px;")}>${R(m.guardado)} de ${R(m.alvo)}</div>`;
  }

  /** Quadradinho de calendário: mês abreviado em cima, o dia embaixo. */
  function calendario(dia: number, mes: string, tam = 56, centro = false): string {
    return `<table ${T0}${centro ? ' align="center"' : ""}><tr><td width="${tam}" align="center"${sx({ bg: "accentTint" }, `width:${tam}px;border-radius:14px;padding:8px 0;`)}><div${sx({ c: "accent" }, "font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.08em;")}>${mes}</div><div${sx({ c: "ink" }, `font-size:${Math.round(tam * 0.42)}px;line-height:${Math.round(tam * 0.5)}px;font-weight:300;`)}>${dia}</div></td></tr></table>`;
  }

  /**
   * O topo do e-mail: o degradê do herói do tema, o logo Aurora no centro e o conteúdo embaixo
   * dele. `sozinho` quando o herói é o cartão inteiro (cantos de baixo também redondos).
   */
  function heroi(conteudo: string, sozinho = false): string {
    return `<tr><td class="heroi px" bgcolor="${L.heroPara}" align="center" style="background-color:${L.heroPara};background-image:linear-gradient(160deg,${L.heroDe} 0%,${L.heroPara} 75%);border-radius:${sozinho ? "24px" : "24px 24px 0 0"};padding:32px 32px 30px;text-align:center;"><img src="${URL_DAS_IMAGENS}/logo-${key}.png" width="52" height="52" alt="SPI Finance" style="display:block;margin:0 auto 18px;border:0;border-radius:13px;">${conteudo}</td></tr>`;
  }

  /** O CSS do modo escuro: cada classe de cor ganha a versão escura do tema. */
  function cssEscuro(): string {
    const tons = Object.keys(D) as Tom[];
    const regras: [string, string][] = [];
    for (const t of tons) {
      regras.push([`.bg-${t}`, `background-color:${D[t]}!important;`]);
      regras.push([`.c-${t}`, `color:${D[t]}!important;`]);
      regras.push([`.bd-${t}`, `border-color:${D[t]}!important;`]);
    }
    const heroi = `.heroi{background-image:linear-gradient(160deg,${D.heroDe} 0%,${D.heroPara} 75%)!important;background-color:${D.heroPara}!important;}`;
    const dentro = regras.map(([s, d]) => `${s}{${d}}`).join("\n    ");
    const ogsc = regras.filter(([s]) => s.startsWith(".c-")).map(([s, d]) => `[data-ogsc] ${s}{${d}}`).join("\n  ");
    const ogsb = regras.filter(([s]) => s.startsWith(".bg-")).map(([s, d]) => `[data-ogsb] ${s}{${d}}`).join("\n  ");
    return `  @media (prefers-color-scheme: dark){\n    ${dentro}\n    ${heroi}\n  }\n  ${ogsc}\n  ${ogsb}`;
  }

  /**
   * A moldura: fundo do tema, os cartões empilhados e o rodapé com o link das preferências.
   * `cartoes` são linhas de tabela (<tr>...</tr>) já montadas, uma string por cartão.
   */
  function moldura(params: { titulo: string; preheader: string; cartoes: Cartao[]; rodape: string; preferenciasUrl?: string }): string {
    const corpo = params.cartoes
      .map((c) => `<tr><td${sx({ bg: "surface" }, "border-radius:24px;")}><table ${T0} width="100%">${c}</table></td></tr><tr><td height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>`)
      .join("\n");
    const preferencias = params.preferenciasUrl ? `<br><a href="${params.preferenciasUrl}" target="_blank"${sx({ c: "muted" }, "text-decoration:underline;")}>Preferências de e-mail</a> &nbsp;·&nbsp; SPI Finance` : "<br>SPI Finance, sua vida financeira em um só lugar.";
    return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${params.titulo}</title>
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;outline:none;}
  a{text-decoration:none;}
  b{font-weight:600;}
  @media (max-width:480px){
    .px{padding-left:20px!important;padding-right:20px!important;}
    .num-64{font-size:50px!important;}
    .num-56{font-size:46px!important;}
    .num-40{font-size:34px!important;}
    .pad-out{padding:12px 8px!important;}
  }
${cssEscuro()}
</style>
</head>
<body${sx({ bg: "canvas" }, "margin:0;padding:0;")}>
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${params.preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table ${T0} width="100%"${sx({ bg: "canvas" })}><tr><td align="center" class="pad-out" style="padding:28px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table ${T0} width="100%" style="max-width:600px;font-family:${FONTE};">
${corpo}
<tr><td align="center"${sx({ c: "muted" }, "padding:8px 24px 24px;font-size:12px;line-height:18px;")}>${params.rodape}${preferencias}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
  }

  return {
    tema: key,
    cores: { claro: L, escuro: D },
    sx, numero, R, Rtexto, valor, eyebrow, espaco, texto, suave, pequeno, titulo, destaque, link, pad,
    barra, legenda, grafico, icone, tomDaCategoria, botao, caixa, caixaDeFala, tresNumeros, linhaCategoria, linhaMeta,
    calendario, heroi, moldura,
  };
}

export type Blocos = ReturnType<typeof criarBlocos>;
