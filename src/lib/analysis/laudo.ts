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
    v < 1
      ? `Pra cada R$ 1 de conta que vence em 12 meses, tem R$ ${v.toFixed(2).replace(".", ",")} de caixa e a receber no mesmo prazo — não é sobre quanto a ação negocia na bolsa`
      : `Pra cada R$ 1 de conta que vence em 12 meses, tem R$ ${v.toFixed(2).replace(".", ",")} de caixa e a receber no mesmo prazo`,
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
  divida_liquida_ebitda: "Dívida ÷ caixa que gera",
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

/**
 * O "?" de cada indicador: o que é, em uma ou duas frases que uma pessoa sem mercado entende.
 * Nada de fórmula — a fórmula está na régua. Aqui é "o que esse número mede na vida real".
 */
export const GLOSSARY: Record<string, string> = {
  p_l: "P/L, preço sobre lucro: quantos anos de lucro a empresa levaria pra devolver o que a ação custa hoje. Quanto menor, mais barata pelo lucro que dá.",
  p_vp: "P/VP, preço sobre valor patrimonial: quanto a ação custa comparado ao patrimônio da empresa. 1 = vale o que tem; 2 = o dobro.",
  ev_ebitda: "EV/EBITDA: o preço da empresa inteira (com as dívidas) dividido pelo caixa que a operação gera num ano. Quanto menor, mais barata pelo caixa que produz.",
  dividend_yield: "Dividend yield: quanto a empresa pagou de dividendo nos últimos 12 meses, em porcentagem do preço da ação. 8% = a cada R$ 100 na ação, R$ 8 voltaram pra você.",
  roe: "ROE, retorno sobre o patrimônio: de cada R$ 100 que pertencem aos sócios, quanto virou lucro no ano. Mede se a empresa faz o dinheiro dos donos render.",
  roic: "ROIC, retorno sobre o capital investido: de cada R$ 100 aplicados no negócio (dos sócios e de dívida), quanto voltou no ano. Mede a qualidade da operação.",
  margem_liquida: "Margem líquida: de cada R$ 100 que a empresa vende, quanto sobra depois de TODAS as despesas, juros e impostos.",
  margem_ebit: "Margem EBIT: de cada R$ 100 vendidos, quanto sobra antes de pagar juros e impostos. Mostra se o negócio em si é bom, sem o efeito da dívida.",
  divida_liquida_ebitda: "Dívida líquida sobre EBITDA: a dívida (já descontado o caixa) dividida pelo que a operação gera por ano. 2× = dois anos de caixa pra quitar tudo.",
  divida_liquida_patrimonio: "Dívida líquida sobre patrimônio: quanto a empresa deve comparado ao que os sócios têm nela. 0,5 = deve metade do patrimônio.",
  liquidez_corrente: "Liquidez corrente: o caixa mais o que tem a receber nos próximos 12 meses, dividido pelas contas que vencem nos próximos 12 meses. Abaixo de 1, o curto prazo não fecha sozinho. Não é sobre quanto a ação negocia na bolsa.",
  evolucao_receita: "Crescimento da receita em 5 anos: a empresa está vendendo mais ou menos do que vendia cinco anos atrás.",
  evolucao_lucro: "Crescimento do lucro em 5 anos: a empresa está lucrando mais ou menos do que cinco anos atrás.",
  vacancia_atual: "Vacância: a porcentagem da área dos imóveis do fundo que está vazia, sem inquilino pagando aluguel.",
  taxa_administracao: "Taxa de administração: o que o fundo cobra por ano, em porcentagem do patrimônio, pra ser administrado. Sai do seu rendimento.",
  liquidez_fii: "Liquidez diária: quanto dinheiro em cotas desse fundo troca de mão por dia na bolsa. Quanto maior, mais fácil comprar e vender sem mexer no preço.",
  numero_imoveis: "Número de imóveis: em quantos endereços o fundo tem imóveis. Mais imóveis = a renda depende menos de um inquilino ou de um prédio só.",
  patrimonio_liquido: "Patrimônio do fundo: o valor de tudo que o fundo tem. Fundos grandes costumam negociar melhor e correm menos risco de fechar.",
  patrimonio_liquido_etf: "Patrimônio do fundo: o valor de tudo que o ETF tem. Fundos grandes costumam negociar melhor e correm menos risco de fechar.",
  dividend_yield_etf: "Dividend yield: quanto o ETF distribuiu nos últimos 12 meses, em porcentagem do preço. Muitos ETFs reinvestem em vez de pagar — DY baixo não é defeito.",
  rentabilidade_12m: "Rentabilidade em 12 meses: quanto o ETF rendeu (ou perdeu) no último ano. Compare sempre com o índice que ele copia.",
  rentabilidade_5anos: "Rentabilidade em 5 anos: quanto o ETF rendeu (ou perdeu) nos últimos cinco anos, acumulado.",
};

/** O "?" de cada pergunta: o que ela olha e por quê. */
export const QUESTION_HELP: Record<string, string> = {
  preco: "Compara o preço da ação com o lucro, o patrimônio e o caixa que a empresa gera — e com o dividendo que ela paga. Responde se você está pagando caro pelo que leva.",
  lucro: "Olha quanto a empresa lucra sobre o dinheiro dos sócios, sobre o que investe e sobre o que vende. Responde se o negócio é bom em transformar dinheiro em mais dinheiro.",
  divida: "Olha o tamanho da dívida comparado ao caixa que a empresa gera e ao patrimônio, e se o caixa de curto prazo cobre as contas de curto prazo.",
  crescimento: "Compara as vendas e o lucro de hoje com os de cinco anos atrás. Responde se a empresa está andando pra frente ou pra trás.",
  tamanho: "Olha quantos imóveis o fundo tem e o tamanho do patrimônio. Responde se a renda depende de poucos endereços e se o fundo é grande o bastante pra negociar bem.",
  ocupacao: "Olha a vacância: quanto da área dos imóveis está sem inquilino. Área vazia é aluguel que não entra.",
  custo: "Olha a taxa de administração — o que sai do seu rendimento todo ano pra pagar quem cuida do fundo.",
  liquidez: "Olha quanto o fundo negocia por dia na bolsa. Responde se você consegue comprar e vender sem dificuldade e sem mexer no preço.",
  renda: "Olha quanto o ETF distribuiu em dividendos nos últimos 12 meses.",
  retorno: "Olha quanto o ETF rendeu em 12 meses e em 5 anos. Passado não garante futuro, e o que importa é seguir bem o índice dele.",
};

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
