import type { SheetType } from "@prisma/client";
import { buildStockOverview, parseIndicatorNumber, type OverviewItem, type OverviewSignal } from "./stock-overview";
import { buildFiiOverview } from "./fii-overview";
import { buildEtfOverview } from "./etf-overview";

/**
 * O LAUDO: a leitura automática de um ativo, em português, pronta pra abrir a ficha.
 *
 * Nasceu de um número: 8 fichas no banco, 3 pessoas, 136 respostas, UMA nota, zero
 * conclusões. A ficha antiga pedia que a aluna desse nota de 0 a 10 em 22 critérios — pedia
 * dela a expertise que o app deveria estar fornecendo. As réguas (stock/fii/etf-overview)
 * já existiam; ficavam escondidas dentro do formulário. Aqui elas viram a resposta que abre
 * a tela: quantos sinais favoráveis, quantos de atenção, uma frase, uma nota.
 *
 * Nunca um veredito de compra ou venda. Os selos são réguas gerais e cegas a setor; o laudo
 * diz isso no próprio caso, não só num aviso de rodapé.
 */

export type LaudoItem = OverviewItem & {
  /** Uma linha em português do que o número significa, com o valor dentro. */
  plain: string;
};

export type LaudoSection = {
  id: string;
  /** A pergunta de gente que o bloco responde ("Está cara ou barata?"). */
  question: string;
  items: LaudoItem[];
};

export type Laudo = {
  sheetType: SheetType;
  sections: LaudoSection[];
  counts: Record<OverviewSignal, number>;
  /** favorável = 10, na média = 6, atenção = 2; média simples. null sem itens. */
  autoScore: number | null;
  /** A frase de abertura: o veredito curto, com os pontos de atenção nomeados. */
  verdict: string;
  /** Nota de setor/limite que muda conforme o tipo — vai no rodapé do laudo. */
  caveat: string;
  /** Fatos que não têm régua mas ajudam a situar (segmento, mandato, nº de imóveis...). */
  facts: { label: string; value: string }[];
  /** ISO. */
  readAt: string;
};

export type LaudoChange = {
  key: string;
  label: string;
  from: OverviewSignal | null;
  to: OverviewSignal | null;
  fromValue: string | null;
  toValue: string | null;
};

const SIGNAL_SCORE: Record<OverviewSignal, number> = { favoravel: 10, neutro: 6, atencao: 2 };

/** Ordem e agrupamento por tipo: cada bloco é uma pergunta que uma pessoa faria, não um capítulo de manual. */
const SECTIONS: Record<SheetType, { id: string; question: string; keys: string[] }[]> = {
  STOCK: [
    { id: "preco", question: "Está cara ou barata?", keys: ["p_l", "p_vp", "ev_ebitda", "dividend_yield"] },
    { id: "lucro", question: "Dá lucro?", keys: ["roe", "roic", "margem_liquida", "margem_ebit"] },
    { id: "divida", question: "Deve muito?", keys: ["divida_liquida_ebitda", "divida_liquida_patrimonio", "liquidez_corrente"] },
    { id: "crescimento", question: "Está crescendo?", keys: ["evolucao_receita", "evolucao_lucro"] },
  ],
  STOCK_INTL: [
    { id: "preco", question: "Está cara ou barata?", keys: ["p_l", "p_vp", "ev_ebitda", "dividend_yield"] },
    { id: "lucro", question: "Dá lucro?", keys: ["roe", "roic", "margem_liquida", "margem_ebit"] },
    { id: "divida", question: "Deve muito?", keys: ["divida_liquida_ebitda", "divida_liquida_patrimonio", "liquidez_corrente"] },
    { id: "crescimento", question: "Está crescendo?", keys: ["evolucao_receita", "evolucao_lucro"] },
  ],
  FII: [
    { id: "preco", question: "Está cara ou barata?", keys: ["p_vp"] },
    { id: "tamanho", question: "É grande e diversificado?", keys: ["numero_imoveis", "patrimonio_liquido"] },
    { id: "ocupacao", question: "Está cheio?", keys: ["vacancia_atual"] },
    { id: "custo", question: "Cobra muito?", keys: ["taxa_administracao"] },
    { id: "liquidez", question: "Dá pra entrar e sair?", keys: ["liquidez_fii"] },
  ],
  ETF: [
    { id: "tamanho", question: "É grande?", keys: ["patrimonio_liquido_etf"] },
    { id: "renda", question: "Paga dividendo?", keys: ["dividend_yield_etf"] },
    { id: "retorno", question: "Rendeu?", keys: ["rentabilidade_12m", "rentabilidade_5anos"] },
  ],
};

/** Fatos sem régua, por tipo: situam o ativo ("é um fundo de galpões"), não julgam. */
const FACT_KEYS: Record<SheetType, { key: string; label: string }[]> = {
  STOCK: [],
  STOCK_INTL: [],
  FII: [
    { key: "segmento", label: "Segmento" },
    { key: "mandato", label: "Mandato" },
    { key: "tipo_gestao", label: "Gestão" },
  ],
  ETF: [],
};

const CAVEAT: Record<SheetType, string> = {
  STOCK:
    "Réguas gerais de mercado. Bancos, petroleiras e varejo têm números normais bem diferentes entre si — compare com outras do mesmo setor antes de concluir. Não é recomendação de compra ou venda.",
  STOCK_INTL:
    "Réguas gerais de mercado, as mesmas das ações brasileiras. Setor e país mudam o que é normal — compare com pares. O retorno em reais depende também do dólar. Não é recomendação de compra ou venda.",
  FII:
    "Réguas gerais. Fundo de papel e fundo de tijolo têm P/VP e vacância que não se comparam — leia junto com o segmento. Não é recomendação de compra ou venda.",
  ETF:
    "Rentabilidade passada não garante a futura, e o que importa num ETF é seguir bem o índice dele. Não é recomendação de compra ou venda.",
};

function n(value: string): number | null {
  return parseIndicatorNumber(value);
}
function pct(value: number): string {
  return `${Math.round(value)}%`;
}
function reais(value: number): string {
  return `R$ ${Math.round(value)}`;
}

/**
 * A frase de cada indicador, em português de gente, com o valor dentro. Quando não há como
 * traduzir o número (formato inesperado), cai na régua do próprio overview, que já explica.
 */
const PLAIN: Record<string, (v: number, raw: string) => string> = {
  p_l: (v) =>
    v < 0
      ? "Teve prejuízo no período: não dá pra dizer em quantos anos o lucro paga o preço"
      : `Pelo lucro atual, o preço de hoje se paga em ${v.toFixed(1).replace(".", ",")} anos`,
  p_vp: (v) => `Vale ${v.toFixed(2).replace(".", ",")}× o patrimônio que tem`,
  ev_ebitda: (v) => `A empresa inteira custa ${v.toFixed(1).replace(".", ",")} anos de geração de caixa`,
  dividend_yield: (v) => `Pagou ${v.toFixed(1).replace(".", ",")}% do preço em dividendos nos últimos 12 meses`,
  roe: (v) => `De cada R$ 100 dos sócios, ${reais(v)} viram lucro por ano`,
  roic: (v) => `De cada R$ 100 investidos no negócio, ${reais(v)} voltam por ano`,
  margem_liquida: (v) => `De cada R$ 100 vendidos, ${reais(v)} sobram no fim`,
  margem_ebit: (v) => `De cada R$ 100 vendidos, ${reais(v)} sobram antes de juros e impostos`,
  divida_liquida_ebitda: (v) =>
    v < 0 ? "Tem mais dinheiro em caixa do que dívida" : `Quita a dívida com ${v.toFixed(1).replace(".", ",")} anos de caixa`,
  divida_liquida_patrimonio: (v) =>
    v < 0 ? "Tem mais dinheiro em caixa do que dívida" : `A dívida é ${pct(v * 100)} do patrimônio`,
  liquidez_corrente: (v) =>
    v < 1 ? "O caixa de curto prazo não cobre as contas de curto prazo" : `Tem R$ ${v.toFixed(2).replace(".", ",")} de curto prazo pra cada R$ 1 de conta`,
  evolucao_receita: (v) => (v >= 0 ? `Vendeu ${pct(v)} mais que há 5 anos` : `Vendeu ${pct(-v)} menos que há 5 anos`),
  evolucao_lucro: (v) => (v >= 0 ? `Lucra ${pct(v)} mais que há 5 anos` : `Lucra ${pct(-v)} menos que há 5 anos`),
  vacancia_atual: (v) => `${v.toFixed(1).replace(".", ",")}% da área está vazia hoje`,
  numero_imoveis: (v) =>
    v >= 10 ? `Tem ${Math.round(v)} imóveis: a renda não depende de um endereço só` : `Tem ${Math.round(v)} imóveis: a renda depende de poucos endereços`,
  patrimonio_liquido: (_v, raw) => `Um fundo de ${compactValue(raw)}`,
  liquidez_fii: (_v, raw) => `Negocia ${compactValue(raw)} por dia`,
  taxa_administracao: (v) => `Cobra ${v.toFixed(2).replace(".", ",")}% ao ano pra administrar`,
  dividend_yield_etf: (v) => `Pagou ${v.toFixed(1).replace(".", ",")}% em dividendos nos últimos 12 meses`,
  rentabilidade_12m: (v) => (v >= 0 ? `Rendeu ${pct(v)} nos últimos 12 meses` : `Perdeu ${pct(-v)} nos últimos 12 meses`),
  rentabilidade_5anos: (v) => (v >= 0 ? `Rendeu ${pct(v)} em 5 anos` : `Perdeu ${pct(-v)} em 5 anos`),
};

/**
 * O nome que aparece grande no quadradinho. A sigla vem pequena, embaixo. Quem está
 * começando vê "Preço pelo lucro" antes de ver "P/L" — o jargão fica disponível sem ser a
 * primeira coisa que assusta.
 */
export const FRIENDLY_LABEL: Record<string, string> = {
  p_l: "Preço pelo lucro",
  p_vp: "Preço pelo patrimônio",
  ev_ebitda: "Preço pelo caixa que gera",
  dividend_yield: "Dividendos",
  roe: "Retorno pros sócios",
  roic: "Retorno do negócio",
  margem_liquida: "O que sobra de cada venda",
  margem_ebit: "Sobra antes de juros",
  divida_liquida_ebitda: "Dívida pelo caixa",
  divida_liquida_patrimonio: "Dívida pelo patrimônio",
  liquidez_corrente: "Caixa de curto prazo",
  evolucao_receita: "Vendas em 5 anos",
  evolucao_lucro: "Lucro em 5 anos",
  vacancia_atual: "Área vazia",
  taxa_administracao: "Taxa de administração",
  liquidez_fii: "Negociação por dia",
  numero_imoveis: "Imóveis",
  patrimonio_liquido: "Tamanho do fundo",
  patrimonio_liquido_etf: "Tamanho do fundo",
  dividend_yield_etf: "Dividendos",
  rentabilidade_12m: "Rendeu em 12 meses",
  rentabilidade_5anos: "Rendeu em 5 anos",
};

/**
 * O termômetro de cada pergunta: a resposta é a POSIÇÃO do marcador, não uma frase.
 * Esquerda = o lado ruim, direita = o lado bom; o rótulo curto diz onde o marcador caiu.
 */
export const SECTION_SCALE: Record<string, { low: string; high: string; mid: string }> = {
  preco: { low: "cara", high: "barata", mid: "na média" },
  lucro: { low: "pouco", high: "muito", mid: "razoável" },
  divida: { low: "muito", high: "pouco", mid: "na média" },
  crescimento: { low: "encolhendo", high: "crescendo", mid: "parada" },
  tamanho: { low: "pequeno", high: "grande", mid: "médio" },
  ocupacao: { low: "vazio", high: "cheio", mid: "na média" },
  custo: { low: "cara", high: "barata", mid: "na média" },
  liquidez: { low: "difícil", high: "fácil", mid: "na média" },
  renda: { low: "pouco", high: "bem", mid: "na média" },
  retorno: { low: "perdeu", high: "rendeu", mid: "empatou" },
};

const SIGNAL_POSITION: Record<OverviewSignal, number> = { atencao: 0.12, neutro: 0.5, favoravel: 0.88 };

/**
 * Onde o marcador cai (0 = ruim, 1 = bom) e o rótulo que resume. Média das posições dos
 * itens: um ponto de atenção puxa o marcador pro meio mesmo com os outros a favor — que é
 * o que a pessoa deve sentir.
 */
export function sectionGauge(section: LaudoSection): { position: number; label: string; signal: OverviewSignal } {
  const scale = SECTION_SCALE[section.id] ?? { low: "ruim", high: "bom", mid: "na média" };
  const position = section.items.reduce((soma, i) => soma + SIGNAL_POSITION[i.signal], 0) / section.items.length;
  const signal: OverviewSignal = position >= 0.7 ? "favoravel" : position <= 0.3 ? "atencao" : "neutro";
  const label = signal === "favoravel" ? scale.high : signal === "atencao" ? scale.low : scale.mid;
  return { position, label, signal };
}

/** A frase curta de abertura: só os pontos de atenção, nomeados. Nada mais. */
export function attentionLine(laudo: Laudo): { text: string; names: string[] } {
  const names = laudo.sections.flatMap((s) => s.items).filter((i) => i.signal === "atencao").map((i) => FRIENDLY_LABEL[i.key] ?? technicalLabel(i));
  if (names.length === 0) return { text: "Nenhum ponto de atenção nos números de hoje.", names };
  if (names.length === 1) return { text: "Só um ponto de atenção:", names };
  return { text: `${names.length} pontos de atenção:`, names };
}

/** A sigla/nome técnico, sem o parêntese explicativo: "P/L", "ROE", "Dívida Líquida / EBITDA". */
export function technicalLabel(item: Pick<OverviewItem, "label">): string {
  return item.label.replace(/\s*\(.*?\)\s*/g, "").trim();
}

/**
 * A frase de resumo de uma seção — o que a pessoa vê ANTES de abrir os números. Se algum
 * item pede atenção, é ele que fala; senão o primeiro favorável; senão o primeiro. Uma frase
 * por pergunta é o tamanho que uma iniciante lê inteiro.
 */
export function sectionSummary(section: LaudoSection): { text: string; signal: OverviewSignal } {
  const lead =
    section.items.find((i) => i.signal === "atencao") ??
    section.items.find((i) => i.signal === "favoravel") ??
    section.items[0];
  return { text: lead.plain, signal: lead.signal };
}

/** Indicadores cujo valor é uma magnitude ("R$ 7,57 Bilhões") que o parser numérico não lê: a frase usa o texto cru. */
const RAW_ONLY = new Set(["patrimonio_liquido", "liquidez_fii"]);

/**
 * "R$ 7,57 Bilhões" → "R$ 7,57 bi", "R$ 20,64 M" → "R$ 20,64 mi", "R$ 900 mil" fica. Só encurta a
 * unidade, nunca o número: é pra caber no quadradinho sem mudar o que a fonte disse.
 */
export function compactValue(raw: string): string {
  return raw
    .trim()
    .replace(/\s*bilh[õo]es?\b/i, " bi")
    .replace(/\s*milh[õo]es?\b/i, " mi")
    .replace(/\s+B\b/, " bi")
    .replace(/\s+M\b/, " mi")
    .replace(/\s+/g, " ");
}

function plainFor(item: OverviewItem): string {
  const fn = PLAIN[item.key];
  if (!fn) return item.reference;
  const v = n(item.value);
  if (v !== null || RAW_ONLY.has(item.key)) return fn(v ?? Number.NaN, item.value);
  return item.reference;
}

function overviewFor(sheetType: SheetType, indicators: Record<string, string>) {
  if (sheetType === "FII") return buildFiiOverview(indicators);
  if (sheetType === "ETF") return buildEtfOverview(indicators);
  return buildStockOverview(indicators);
}

/** Nomes curtos pra frase de abertura ("liquidez corrente" em vez de "Liquidez Corrente (…)"). */
function shortLabel(item: OverviewItem): string {
  return item.label.replace(/\s*\(.*?\)\s*/g, "").toLowerCase();
}

function buildVerdict(counts: Record<OverviewSignal, number>, items: LaudoItem[]): string {
  const total = counts.favoravel + counts.neutro + counts.atencao;
  if (total === 0) return "Sem indicadores suficientes pra uma leitura.";
  const atencao = items.filter((i) => i.signal === "atencao").map(shortLabel);
  const abre =
    counts.atencao === 0
      ? counts.favoravel >= total * 0.7
        ? "Os números de hoje estão quase todos a favor."
        : "Os números de hoje estão na média, sem ponto de atenção."
      : counts.favoravel > counts.atencao
        ? "Mais pontos a favor do que contra nos números de hoje."
        : "Os números de hoje pedem cuidado.";
  if (atencao.length === 0) return abre;
  const lista = atencao.length === 1 ? atencao[0] : `${atencao.slice(0, -1).join(", ")} e ${atencao[atencao.length - 1]}`;
  return `${abre} Atenção em: ${lista}.`;
}

export function buildLaudo(sheetType: SheetType, indicators: Record<string, string>, readAt = new Date()): Laudo {
  const { items, counts } = overviewFor(sheetType, indicators);
  const byKey = new Map(items.map((i) => [i.key, { ...i, plain: plainFor(i) } satisfies LaudoItem]));

  const sections: LaudoSection[] = SECTIONS[sheetType]
    .map((s) => ({ id: s.id, question: s.question, items: s.keys.map((k) => byKey.get(k)).filter((i): i is LaudoItem => !!i) }))
    .filter((s) => s.items.length > 0);

  const allItems = sections.flatMap((s) => s.items);
  const autoScore =
    allItems.length > 0
      ? Math.round((allItems.reduce((soma, i) => soma + SIGNAL_SCORE[i.signal], 0) / allItems.length) * 10) / 10
      : null;

  const facts = FACT_KEYS[sheetType]
    .map((f) => ({ label: f.label, value: indicators[f.key] }))
    .filter((f): f is { label: string; value: string } => typeof f.value === "string" && f.value.trim() !== "");

  return {
    sheetType,
    sections,
    counts,
    autoScore,
    verdict: buildVerdict(counts, allItems),
    caveat: CAVEAT[sheetType],
    facts,
    readAt: readAt.toISOString(),
  };
}

/** O que mudou entre duas leituras: só itens cujo selo trocou (o número mudar sem trocar de faixa é ruído). */
export function diffLaudo(previous: Laudo | null, next: Laudo): LaudoChange[] {
  if (!previous) return [];
  const before = new Map(previous.sections.flatMap((s) => s.items).map((i) => [i.key, i]));
  const after = new Map(next.sections.flatMap((s) => s.items).map((i) => [i.key, i]));
  const changes: LaudoChange[] = [];
  for (const [key, item] of after) {
    const prev = before.get(key);
    if (!prev) continue;
    if (prev.signal !== item.signal) {
      changes.push({ key, label: item.label, from: prev.signal, to: item.signal, fromValue: prev.value, toValue: item.value });
    }
  }
  return changes;
}

/** Guarda de leitura: o que vem do banco é `Json`, e um snapshot de versão antiga não pode derrubar a tela. */
export function isLaudo(value: unknown): value is Laudo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.sections) && typeof v.counts === "object" && typeof v.verdict === "string" && typeof v.readAt === "string";
}
