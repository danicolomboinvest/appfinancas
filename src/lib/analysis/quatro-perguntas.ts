import type { SheetType } from "@prisma/client";
import { buildStockOverview, parseIndicatorNumber, type OverviewSignal } from "./stock-overview";
import { buildFiiOverview, parseMagnitudeBRL, rendaConstante } from "./fii-overview";
import { buildEtfOverview } from "./etf-overview";
import { compactValue } from "./laudo";

/**
 * As Análises da versão nova (rodadas 28, 48, 52 e 56; plano 3.10): cada ativo responde QUATRO
 * perguntas de gente, e cada pergunta vira um pedaço do anel.
 *
 * As réguas são as do app (stock/fii/etf-overview), agrupadas como no protótipo aprovado. Nada aqui
 * inventa número: pergunta sem dado fica sem cor (força null) e a tela diz que falta o dado. Série
 * que não existe (lucro de 5 anos, preço de 12 meses) não vira gráfico; o cartão fica com a régua e o
 * número. Os dividendos e os rendimentos dos FIIs vêm do histórico real (DividendEvent).
 */

export type Forca = "forte" | "ok" | "atencao";

export type Zona = "bom" | "bom2" | "neu" | "amb";

export type Grafico =
  | { tipo: "colunas"; valores: number[]; rotulos: string[]; topo?: string }
  | { tipo: "regua"; rotulo: string; texto: string; valor: number; min: number; max: number; zonas: [number, Zona][]; extremos?: [string, string] }
  | { tipo: "grande"; numero: string; unidade?: string; lado?: { valor: string; rotulo: string } }
  | { tipo: "barras"; itens: { rotulo: string; texto: string; fracao: number; tom: "tinta" | "bom" }[] }
  | { tipo: "pontos100" };

export type Pergunta = {
  /** Chave estável da pergunta ("lucro", "renda"...). */
  k: string;
  q: string;
  /** null = sem régua (ex.: "Quanto paga?") ou sem dado. */
  f: Forca | null;
  /** A resposta curta, grande no cartão. */
  r: string;
  /** O rótulo curto da legenda do anel ("Lucra", "Deve pouco"). */
  curto: string;
  /** O porquê, num número. null quando não há número. */
  num: string | null;
  /** O "?" da pergunta: a régua usada. */
  ajuda: string;
  graficos: Grafico[];
  /** Linhas miúdas embaixo do gráfico. */
  notas: string[];
};

export type Provento = { pagamento: Date; valor: number };

export type EntradaDoAtivo = {
  tipo: SheetType;
  ticker: string;
  indicadores: Record<string, string>;
  /** Cotação de hoje na moeda do ativo (da Carteira ou da página lida). */
  cotacao: number | null;
  moeda: "BRL" | "USD";
  /** Proventos por cota, histórico inteiro que o app tem. */
  proventos: Provento[];
  hoje: Date;
};

const SINAL: Record<OverviewSignal, Forca> = { favoravel: "forte", neutro: "ok", atencao: "atencao" };
const POSICAO: Record<Forca, number> = { forte: 0.88, ok: 0.5, atencao: 0.12 };

/** O termômetro do laudo (laudo.ts, sectionGauge): média das posições, 0,7 ou mais é forte, 0,3 ou menos é atenção. */
export function termometro(forcas: (Forca | null | undefined)[]): Forca | null {
  const v = forcas.filter((f): f is Forca => !!f);
  if (v.length === 0) return null;
  const pos = v.reduce((t, f) => t + POSICAO[f], 0) / v.length;
  return pos >= 0.7 ? "forte" : pos <= 0.3 ? "atencao" : "ok";
}

/**
 * Como o ativo vai, no anel do topo: o termômetro sobre as perguntas que têm força. "Vai bem" é
 * só o forte; "na média" NÃO conta (regra da canônica: na Ana, 5 de 6, com o HGLG11 na média).
 */
export function geralDoAtivo(perguntas: Pergunta[]): Forca | null {
  return termometro(perguntas.map((p) => p.f));
}

export function vaiBem(geral: Forca | null): boolean {
  return geral === "forte";
}

export function situacao(geral: Forca | null): string {
  return geral === "forte" ? "vai bem" : geral === "atencao" ? "atenção" : geral === "ok" ? "na média" : "sem leitura";
}

/* ------------------------------------------------------------------ números */

export function numBR(v: number, casas = 1): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 }).replace(/^-/, "−");
}
export function num2(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sinalMais(v: number, casas = 0): string {
  return `${v >= 0 ? "+" : ""}${numBR(v, casas)}%`;
}

/**
 * A fonte de ações devolve "0" quando o número não existe para a empresa (banco não tem EBITDA nem
 * dívida líquida no sentido de empresa comum). Zero exato nesses indicadores é "sem dado", não uma
 * empresa sem dívida: tratar como número seria inventar um "deve pouco".
 */
const ZERO_E_SEM_DADO = new Set(["ev_ebitda", "roic", "divida_liquida_ebitda", "divida_liquida_patrimonio", "margem_ebit"]);

function semZerosFalsos(tipo: SheetType, ind: Record<string, string>): Record<string, string> {
  if (tipo !== "STOCK" && tipo !== "STOCK_INTL") return ind;
  const limpo: Record<string, string> = {};
  for (const [k, v] of Object.entries(ind)) {
    if (ZERO_E_SEM_DADO.has(k) && parseIndicatorNumber(v) === 0) continue;
    limpo[k] = v;
  }
  return limpo;
}

function sinaisPorChave(tipo: SheetType, bruto: Record<string, string>): Map<string, { forca: Forca; valor: number | null; bruto: string }> {
  const ind = semZerosFalsos(tipo, bruto);
  const ov = tipo === "FII" ? buildFiiOverview(ind) : tipo === "ETF" ? buildEtfOverview(ind) : buildStockOverview(ind);
  return new Map(ov.items.map((i) => [i.key, { forca: SINAL[i.signal], valor: parseIndicatorNumber(i.value), bruto: i.value }]));
}

/* --------------------------------------------------------------- proventos */

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function chaveMes(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * Os rendimentos dos 12 últimos meses, por mês de pagamento, do mais antigo ao mais novo. A janela
 * acaba no mês atual se ele já tem pagamento (anunciado conta), senão no mês passado. Sem histórico
 * que cubra a janela inteira (o primeiro provento que o app tem é mais novo que o começo dela),
 * devolve null: um mês "zerado" por falta de dado não pode virar queda de renda.
 */
export function proventosMensais(proventos: Provento[], hoje: Date): { valores: number[]; rotulos: string[] } | null {
  if (proventos.length === 0) return null;
  const atual = chaveMes(hoje);
  const temNoAtual = proventos.some((p) => chaveMes(p.pagamento) === atual);
  const fim = temNoAtual ? atual : atual - 1;
  const inicio = fim - 11;
  const primeiro = Math.min(...proventos.map((p) => chaveMes(p.pagamento)));
  if (primeiro > inicio) return null;
  const valores = Array.from({ length: 12 }, () => 0);
  for (const p of proventos) {
    const k = chaveMes(p.pagamento);
    if (k >= inicio && k <= fim) valores[k - inicio] += p.valor;
  }
  const rotulos = valores.map((_, i) => MESES_CURTOS[(inicio + i) % 12]);
  return { valores, rotulos };
}

/**
 * Dividendos por cota em cada um dos 5 últimos anos fechados. Só entram os anos que o histórico
 * cobre (do ano do primeiro provento em diante); com menos de 2 anos não há colunas.
 */
export function dividendosPorAno(proventos: Provento[], hoje: Date): { valores: number[]; rotulos: string[] } | null {
  if (proventos.length === 0) return null;
  const anoAtual = hoje.getUTCFullYear();
  const primeiroAno = Math.min(...proventos.map((p) => p.pagamento.getUTCFullYear()));
  const anos = [5, 4, 3, 2, 1].map((n) => anoAtual - n).filter((a) => a >= primeiroAno);
  if (anos.length < 2) return null;
  const valores = anos.map((a) => proventos.filter((p) => p.pagamento.getUTCFullYear() === a && p.pagamento <= hoje).reduce((t, p) => t + p.valor, 0));
  if (valores.every((v) => v <= 0)) return null;
  return { valores, rotulos: anos.map(String) };
}

/* ------------------------------------------------------------------- ações */

const RESP = {
  lucro: { forte: "Sim", ok: "Mais ou menos", atencao: "Pouco" },
  divida: { forte: "Pouco", ok: "Na média", atencao: "Muito" },
  preco: { forte: "Barata", ok: "Na média", atencao: "Cara" },
  precoFii: { forte: "Barato", ok: "Na média", atencao: "Caro" },
  vender: { forte: "Fácil", ok: "Na média", atencao: "Difícil" },
  rendeu: { forte: "Rendeu", ok: "Empatou", atencao: "Perdeu" },
  grande: { forte: "Muito grande", ok: "Médio", atencao: "Pequeno" },
  cobra: { forte: "Barato", ok: "Na média", atencao: "Caro" },
} as const;

const CURTO = {
  lucro: { forte: "Lucra", ok: "Lucra na média", atencao: "Lucra pouco" },
  divida: { forte: "Deve pouco", ok: "Deve na média", atencao: "Deve muito" },
  paga: { forte: "Paga bem", ok: "Paga pouco", atencao: "Paga pouco" },
  preco: { forte: "Preço barato", ok: "Preço na média", atencao: "Preço caro" },
  renda: { forte: "Todo mês", ok: "Oscila", atencao: "Oscila" },
  vender: { forte: "Fácil", ok: "Na média", atencao: "Difícil" },
  rendeu: { forte: "Rendeu", ok: "Empatou", atencao: "Perdeu" },
  grande: { forte: "Muito grande", ok: "Médio", atencao: "Pequeno" },
  cobra: { forte: "Cobra pouco", ok: "Cobra na média", atencao: "Cobra caro" },
} as const;

const SEM_DADO = "Sem esse dado";

function perguntasDeAcao(e: EntradaDoAtivo): Pergunta[] {
  const s = sinaisPorChave(e.tipo, e.indicadores);
  const v = (k: string) => s.get(k)?.valor ?? null;
  const f = (k: string) => s.get(k)?.forca ?? null;
  const moeda = e.moeda === "USD" ? "US$" : "R$";

  // 1. É uma empresa que ganha dinheiro?
  const lucro = termometro(["roe", "roic", "margem_liquida", "margem_ebit", "evolucao_receita", "evolucao_lucro"].map(f));
  const roe = v("roe");
  const lucroGraf: Grafico[] = roe !== null ? [{ tipo: "regua", rotulo: "Retorno dos sócios", texto: `${numBR(roe, 0)}%`, valor: roe, min: 0, max: 30, zonas: [[10, "amb"], [5, "neu"], [15, "bom"]], extremos: ["pouco", "muito"] }] : [];
  const evo = v("evolucao_lucro");
  const pLucro: Pergunta = {
    k: "lucro",
    q: "Ganha dinheiro?",
    f: lucro,
    r: lucro ? RESP.lucro[lucro] : SEM_DADO,
    curto: lucro ? CURTO.lucro[lucro] : "Lucro",
    num: roe !== null ? `${moeda} ${numBR(roe, 0)} a cada ${moeda} 100 dos sócios, por ano.` : null,
    ajuda: "É o ROE (retorno sobre o patrimônio). Acima de 15% costuma ser favorável; abaixo de 10%, ponto de atenção. A pergunta também olha as margens e o crescimento de vendas e lucro.",
    graficos: lucroGraf,
    notas: evo !== null ? [`Lucro em 5 anos: ${sinalMais(evo)}`] : [],
  };

  // 2. Ela deve muito?
  // Sem nenhum número de dívida (banco), a liquidez corrente sozinha não responde "deve muito?".
  const temDivida = s.has("divida_liquida_ebitda") || s.has("divida_liquida_patrimonio");
  const divida = temDivida ? termometro(["divida_liquida_ebitda", "divida_liquida_patrimonio", "liquidez_corrente"].map(f)) : null;
  const dle = v("divida_liquida_ebitda");
  const pDivida: Pergunta = {
    k: "divida",
    q: "Ela deve muito?",
    f: divida,
    r: divida ? RESP.divida[divida] : SEM_DADO,
    curto: divida ? CURTO.divida[divida] : "Dívida",
    num:
      dle !== null
        ? dle < 0
          ? "Tem mais dinheiro em caixa do que dívida."
          : `A dívida é ${numBR(dle)} vezes o que ela gera de caixa num ano.`
        : divida
          ? null
          : "A fonte não traz a dívida desta empresa. Acontece com bancos, que vivem de emprestar.",
    ajuda: "Dívida líquida ÷ EBITDA: abaixo de 2x costuma ser confortável; acima de 3,5x, ponto de atenção. Também olha dívida ÷ patrimônio e o caixa de curto prazo.",
    graficos:
      dle !== null
        ? [{ tipo: "regua", rotulo: "Dívida ÷ caixa de 1 ano", texto: `${numBR(dle)}x`, valor: dle, min: -1, max: 5, zonas: [[1, "bom"], [2, "bom2"], [1.5, "neu"], [1.5, "amb"]], extremos: ["tem caixa", "deve muito"] }]
        : [],
    notas: dle !== null ? [dle < 0 ? "Mais caixa do que dívida" : "Abaixo de 2x é confortável"] : [],
  };

  // 3. Paga bem quem investe? (dividendo numa pergunta própria; nunca é atenção)
  const dy = v("dividend_yield");
  const paga: Forca | null = dy === null ? null : dy >= 5 ? "forte" : "ok";
  const porAno = dividendosPorAno(e.proventos, e.hoje);
  const pagaGraf: Grafico[] = [];
  if (dy !== null) pagaGraf.push({ tipo: "grande", numero: numBR(dy), unidade: "%" });
  if (porAno) pagaGraf.push({ tipo: "colunas", valores: porAno.valores, rotulos: porAno.rotulos });
  const pPaga: Pergunta = {
    k: "paga",
    q: "Paga bem?",
    f: paga,
    r: paga === "forte" ? "Bem" : paga === "ok" ? "Pouco" : SEM_DADO,
    curto: paga ? CURTO.paga[paga] : "Dividendos",
    num: dy !== null ? `A cada ${moeda} 1.000, uns ${moeda} ${numBR((1000 * dy) / 100 / 12, 0)} por mês em dividendos (${numBR(dy)}% em 12 meses).` : null,
    ajuda: "Dividend yield: 5% ou mais em 12 meses é alto. Abaixo disso não é defeito: empresa que cresce costuma pagar menos.",
    graficos: pagaGraf,
    notas: [
      ...(dy !== null ? [`Em 12 meses · ${moeda} ${numBR((1000 * dy) / 100 / 12, 0)} por mês a cada ${moeda} 1.000`] : []),
      ...(porAno ? ["Colunas: dividendos por ação em cada ano"] : []),
    ],
  };

  // 4. Está cara ou barata hoje?
  const preco = termometro(["p_l", "p_vp", "ev_ebitda"].map(f));
  const pl = v("p_l");
  const reguasPreco: Grafico[] = (
    [
      ["Preço ÷ lucro", v("p_l"), 30, 15, 25],
      ["Preço ÷ patrimônio", v("p_vp"), 4, 1, 2.5],
      ["Preço ÷ caixa que gera", v("ev_ebitda"), 20, 6, 12],
    ] as [string, number | null, number, number, number][]
  )
    .filter((r): r is [string, number, number, number, number] => r[1] !== null)
    .map(([rotulo, valor, max, bom, caro]) => ({ tipo: "regua", rotulo, texto: `${numBR(valor)}x`, valor, min: 0, max, zonas: [[bom, "bom"], [caro - bom, "neu"], [max - caro, "amb"]] }) satisfies Grafico);
  const pPreco: Pergunta = {
    k: "preco",
    q: "Está cara ou barata hoje?",
    f: preco,
    r: preco ? RESP.preco[preco] : SEM_DADO,
    curto: preco ? CURTO.preco[preco] : "Preço",
    num: pl !== null ? (pl < 0 ? "Teve prejuízo: não dá para dizer em quantos anos o lucro paga o preço." : `O preço é ${numBR(pl)} vezes o lucro de um ano.`) : null,
    ajuda: "P/L: abaixo de 15 costuma ser confortável; acima de 25, ponto de atenção. Também olha P/VP e EV/EBITDA. Não existe preço certo.",
    graficos: reguasPreco,
    notas: reguasPreco.length ? ["Verde = barato · âmbar = caro"] : [],
  };

  return [pLucro, pDivida, pPaga, pPreco];
}

/* --------------------------------------------------------------------- FII */

function perguntasDeFii(e: EntradaDoAtivo): Pergunta[] {
  const s = sinaisPorChave("FII", e.indicadores);
  const mensal = proventosMensais(e.proventos, e.hoje);
  const sinalRenda = mensal ? rendaConstante(mensal.valores) : null;
  const renda = sinalRenda ? SINAL[sinalRenda] : null;
  const ultimo = mensal ? mensal.valores[mensal.valores.length - 1] : null;

  const pRenda: Pergunta = {
    k: "renda",
    q: "A renda é constante?",
    f: renda,
    r: renda === "forte" ? "Sim, todo mês" : renda ? "Oscila" : "Ainda sem 12 meses",
    curto: renda ? CURTO.renda[renda] : "Renda",
    num: renda === "forte" ? "Pagou nos 12 últimos meses, sem cair mais de 20% de um mês para o outro." : renda ? "Em algum dos 12 últimos meses, o rendimento caiu mais de 20% de um mês para o outro." : "O app ainda não tem 12 meses de rendimentos deste fundo.",
    ajuda: "Pelo histórico de rendimentos dos 12 últimos meses: forte se nenhum mês caiu mais de 20% em relação ao anterior.",
    graficos: mensal ? [{ tipo: "colunas", valores: mensal.valores, rotulos: mensal.rotulos, topo: ultimo !== null ? `R$ ${num2(ultimo)}` : undefined }] : [],
    notas: renda === "forte" ? ["12 meses pagando, sem queda forte"] : renda ? ["Teve mês com queda forte"] : [],
  };

  // Os mesmos 12 meses da renda constante: o que pagou neles, por cota.
  const pago12 = mensal ? mensal.valores.reduce((t, v) => t + v, 0) : null;
  const porMes = pago12 !== null ? pago12 / 12 : null;
  const dy = pago12 !== null && e.cotacao ? (pago12 / e.cotacao) * 100 : null;
  const pPaga: Pergunta = {
    k: "paga",
    q: "Quanto paga?",
    f: null,
    r: porMes !== null ? `R$ ${num2(porMes)} por cota` : SEM_DADO,
    curto: porMes !== null ? `R$ ${num2(porMes)}` : "Quanto paga",
    num: dy !== null ? `A cada R$ 1.000, uns R$ ${numBR((1000 * dy) / 100 / 12, 0)} por mês (${numBR(dy)}% em 12 meses, pelo que pagou).` : null,
    ajuda: "Pelo que o fundo pagou nos últimos 12 meses. O passado não garante o futuro.",
    graficos: dy !== null && porMes !== null ? [{ tipo: "grande", numero: numBR(dy), unidade: "%", lado: { valor: `R$ ${num2(porMes)}`, rotulo: "por cota, por mês" } }] : [],
    notas: dy !== null ? ["Em 12 meses, pelo que pagou", `R$ ${numBR((1000 * dy) / 100 / 12, 0)} por mês a cada R$ 1.000`] : [],
  };

  const pvp = s.get("p_vp");
  const precoF = pvp?.forca ?? null;
  const precoGraf: Grafico[] = [];
  if (pvp?.valor && e.cotacao) {
    const patrimonio = e.cotacao / pvp.valor;
    const mx = Math.max(e.cotacao, patrimonio);
    precoGraf.push({
      tipo: "barras",
      itens: [
        { rotulo: "Cota na bolsa", texto: `R$ ${num2(e.cotacao)}`, fracao: e.cotacao / mx, tom: "tinta" },
        { rotulo: "Patrimônio por cota", texto: `R$ ${num2(patrimonio)}`, fracao: patrimonio / mx, tom: "bom" },
      ],
    });
  }
  if (pvp?.valor != null) {
    precoGraf.push({ tipo: "regua", rotulo: "Preço ÷ patrimônio", texto: `${numBR(pvp.valor, 2)}x`, valor: pvp.valor, min: 0.6, max: 1.6, zonas: [[0.35, "bom"], [0.2, "neu"], [0.45, "amb"]], extremos: ["desconto", "ágio"] });
  }
  const pPreco: Pergunta = {
    k: "preco",
    q: "Está caro ou barato hoje?",
    f: precoF,
    r: precoF ? RESP.precoFii[precoF] : SEM_DADO,
    curto: precoF ? CURTO.preco[precoF] : "Preço",
    num: pvp?.valor != null ? `Cada R$ 1 de patrimônio do fundo custa R$ ${numBR(pvp.valor, 2)} na bolsa.` : null,
    ajuda: "P/VP: abaixo de 0,95 é desconto; acima de 1,15, ágio alto.",
    graficos: precoGraf,
    notas: [],
  };

  const liq = s.get("liquidez_fii");
  const liqValor = liq ? parseMagnitudeBRL(liq.bruto) : null;
  const vender = liq?.forca ?? null;
  const pVender: Pergunta = {
    k: "vender",
    q: "Dá para entrar e sair fácil?",
    f: vender,
    r: vender ? RESP.vender[vender] : SEM_DADO,
    curto: vender ? CURTO.vender[vender] : "Liquidez",
    num: liq ? `Negocia uns ${compactValue(liq.bruto)} por dia.` : null,
    ajuda: "Liquidez diária: acima de R$ 1 milhão por dia é fácil; abaixo de R$ 100 mil, difícil.",
    graficos:
      liq && liqValor && liqValor > 0
        ? [{ tipo: "regua", rotulo: "Negocia por dia", texto: compactValue(liq.bruto), valor: Math.log10(liqValor), min: 4.5, max: 7.5, zonas: [[0.5, "amb"], [1, "neu"], [1.5, "bom"]], extremos: ["R$ 100 mil", "R$ 1 mi ou mais"] }]
        : [],
    notas: [],
  };

  return [pRenda, pPaga, pPreco, pVender];
}

/* --------------------------------------------------------------------- ETF */

/** ETFs muito conhecidos e o índice que copiam (fato público do regulamento de cada um). */
const INDICE_DO_ETF: Record<string, { r: string; num: string; sp500?: true }> = {
  VOO: { r: "As 500 maiores dos EUA", num: "Copia o S&P 500: você leva um pedacinho de cada uma das 500 maiores empresas americanas.", sp500: true },
  IVV: { r: "As 500 maiores dos EUA", num: "Copia o S&P 500: você leva um pedacinho de cada uma das 500 maiores empresas americanas.", sp500: true },
  SPY: { r: "As 500 maiores dos EUA", num: "Copia o S&P 500: você leva um pedacinho de cada uma das 500 maiores empresas americanas.", sp500: true },
  IVVB11: { r: "As 500 maiores dos EUA", num: "Copia o S&P 500 na B3, em reais: o dólar já entra no preço.", sp500: true },
  SPXI11: { r: "As 500 maiores dos EUA", num: "Copia o S&P 500 na B3, em reais: o dólar já entra no preço.", sp500: true },
  BOVA11: { r: "O Ibovespa", num: "Copia o Ibovespa: as ações mais negociadas da bolsa brasileira." },
  BOVV11: { r: "O Ibovespa", num: "Copia o Ibovespa: as ações mais negociadas da bolsa brasileira." },
  SMAL11: { r: "Empresas menores da B3", num: "Copia o índice de small caps da B3: empresas brasileiras menores." },
  QQQ: { r: "As 100 da Nasdaq", num: "Copia o Nasdaq-100: as 100 maiores empresas fora do setor financeiro da Nasdaq." },
  VT: { r: "Ações do mundo todo", num: "Copia um índice de ações do mundo inteiro." },
};

function perguntasDeEtf(e: EntradaDoAtivo): Pergunta[] {
  const s = sinaisPorChave("ETF", e.indicadores);
  const idx = INDICE_DO_ETF[e.ticker.toUpperCase()];
  const pOque: Pergunta = {
    k: "oque",
    q: "O que ele é?",
    f: null,
    r: idx?.r ?? "Um fundo que copia um índice",
    curto: idx?.sp500 ? "500 empresas" : "O que é",
    num: idx?.num ?? null,
    ajuda: "ETF é um fundo que copia um índice.",
    graficos: idx?.sp500 ? [{ tipo: "pontos100" }] : [],
    notas: idx?.sp500 ? ["Cada ponto = 5 empresas americanas"] : [],
  };

  const r12 = s.get("rentabilidade_12m")?.valor ?? null;
  const r5 = s.get("rentabilidade_5anos")?.valor ?? null;
  const rendeu = termometro([s.get("rentabilidade_12m")?.forca, s.get("rentabilidade_5anos")?.forca]);
  const emDolar = e.moeda === "USD";
  const partes = [r12 !== null ? `${sinalMais(r12)} em 12 meses` : null, r5 !== null ? `${sinalMais(r5)} em 5 anos` : null].filter(Boolean);
  const mx = Math.max(Math.abs(r12 ?? 0), Math.abs(r5 ?? 0)) || 1;
  const pRendeu: Pergunta = {
    k: "rendeu",
    q: "Rendeu?",
    f: rendeu,
    r: rendeu ? RESP.rendeu[rendeu] : SEM_DADO,
    curto: rendeu ? CURTO.rendeu[rendeu] : "Rendeu",
    num: partes.length ? `${partes.join(" e ")}${emDolar ? ", em dólar" : ""}.` : null,
    ajuda: "Só diz se rendeu no período. Compare com o índice que ele copia.",
    graficos: partes.length
      ? [
          {
            tipo: "barras",
            itens: [
              ...(r12 !== null ? [{ rotulo: "12 meses", texto: sinalMais(r12), fracao: Math.abs(r12) / mx, tom: "bom" as const }] : []),
              ...(r5 !== null ? [{ rotulo: "5 anos", texto: sinalMais(r5), fracao: Math.abs(r5) / mx, tom: "bom" as const }] : []),
            ],
          },
        ]
      : [],
    notas: partes.length ? [emDolar ? "Em dólar" : "Em reais"] : [],
  };

  const pat = s.get("patrimonio_liquido_etf");
  const grande = pat?.forca ?? null;
  const pGrande: Pergunta = {
    k: "grande",
    q: "É grande e seguro de negociar?",
    f: grande,
    r: grande ? RESP.grande[grande] : SEM_DADO,
    curto: grande ? CURTO.grande[grande] : "Tamanho",
    num: pat ? `Patrimônio de ${compactValue(pat.bruto)}.` : null,
    ajuda: "Patrimônio acima de R$ 500 milhões costuma ser favorável; abaixo de R$ 50 milhões, ponto de atenção.",
    graficos: pat ? [{ tipo: "grande", numero: compactValue(pat.bruto) }] : [],
    notas: pat ? ["Acima de R$ 500 milhões já é grande"] : [],
  };

  const taxa = s.get("taxa_administracao_etf");
  const cobra = taxa?.forca ?? null;
  const pCobra: Pergunta = {
    k: "cobra",
    q: "Cobra quanto?",
    f: cobra,
    r: taxa?.valor != null ? `${numBR(taxa.valor, 2)}% ao ano` : SEM_DADO,
    curto: cobra ? CURTO.cobra[cobra] : "Taxa",
    num: taxa?.valor != null ? `De cada R$ 1.000, R$ ${numBR(taxa.valor * 10, 1)} por ano de taxa.` : "A fonte que o app lê ainda não traz a taxa deste ETF.",
    ajuda: "A taxa sai do próprio fundo. Até 1% ao ano é barata; acima de 1,5%, cara.",
    graficos:
      taxa?.valor != null
        ? [{ tipo: "regua", rotulo: "Taxa por ano", texto: `${numBR(taxa.valor, 2)}%`, valor: taxa.valor, min: 0, max: 1.5, zonas: [[1, "bom"], [0.5, "neu"], [0.5, "amb"]], extremos: ["barato", "caro"] }]
        : [],
    notas: [],
  };

  return [pOque, pRendeu, pGrande, pCobra];
}

/** As quatro perguntas do ativo, pelo tipo da análise. */
export function perguntasDoAtivo(e: EntradaDoAtivo): Pergunta[] {
  if (e.tipo === "FII") return perguntasDeFii(e);
  if (e.tipo === "ETF") return perguntasDeEtf(e);
  return perguntasDeAcao(e);
}

/* -------------------------------------------------------------- renda fixa */

export type EntradaRendaFixa = {
  nome: string;
  classe: "RENDA_FIXA" | "TESOURO_DIRETO";
  indexador: "POS_FIXADO" | "IPCA" | "PREFIXADO" | null;
};

const IR_REGRESSIVO = "22,5% até 6 meses, 20% até 1 ano, 17,5% até 2 anos e 15% depois.";

/**
 * As quatro perguntas da renda fixa ("Quanto rende? Até quando? Tem garantia? Posso tirar antes?"),
 * só com o que dá para saber pelo cadastro do título. O que não está no nome nem na regra pública
 * do produto fica sem resposta, nunca chutado.
 */
export function perguntasRendaFixa(e: EntradaRendaFixa): Pergunta[] {
  const nome = e.nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tesouro = e.classe === "TESOURO_DIRETO" || /\btesouro\b/i.test(nome);
  const cdi = nome.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:do\s*)?cdi/i);
  const ipca = nome.match(/ipca\s*\+\s*(\d+(?:[.,]\d+)?)\s*%/i);
  const pre = nome.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:a\.?a\.?|ao ano)/i);

  let rende: string | null = null;
  if (cdi) rende = `${cdi[1].replace(".", ",")}% do CDI`;
  else if (ipca) rende = `IPCA + ${ipca[1].replace(".", ",")}% ao ano`;
  else if (/selic/i.test(nome)) rende = "Acompanha a Selic";
  else if (pre && e.indexador === "PREFIXADO") rende = `${pre[1].replace(".", ",")}% ao ano`;
  else if (e.indexador === "IPCA") rende = "Inflação + uma taxa fixa";
  else if (e.indexador === "PREFIXADO") rende = "Uma taxa fixa";
  else if (e.indexador === "POS_FIXADO") rende = "Acompanha o CDI ou a Selic";

  const ano = nome.match(/\b(20\d{2})\b/);
  const fgc = /\b(cdb|rdb|lci|lca|lc|caixinha|poupanca)\b/i.test(nome);
  const garantia = tesouro ? "Tesouro Nacional" : fgc ? "FGC" : null;
  const garantiaNum = tesouro ? "Garantido pelo Tesouro Nacional (o governo)." : fgc ? "FGC, até R$ 250 mil por banco." : null;
  const tirar = tesouro
    ? { r: "Sim, todo dia útil", num: "Sim, todo dia útil, pelo preço do dia. Antes do vencimento pode render menos." }
    : /\bcaixinha\b/i.test(nome)
      ? { r: "Sim, quando quiser", num: "Sim, quando quiser (liquidez diária)." }
      : null;

  return [
    { k: "rende", q: "Quanto rende?", f: null, r: rende ?? "O combinado na compra", curto: "Rende", num: `Imposto de renda: ${IR_REGRESSIVO}`, ajuda: "O IR de renda fixa cai com o tempo.", graficos: [], notas: [] },
    {
      k: "ate",
      q: "Até quando?",
      f: null,
      r: ano ? ano[1] : SEM_DADO,
      curto: "Prazo",
      num: ano ? `Vence em ${ano[1]}. Até lá, rende o combinado.` : "O vencimento não está no cadastro deste título.",
      ajuda: "",
      graficos: [],
      notas: [],
    },
    { k: "gar", q: "Tem garantia?", f: null, r: garantia ?? SEM_DADO, curto: "Garantia", num: garantiaNum, ajuda: "O FGC cobre até R$ 250 mil por banco. Tesouro é garantido pelo governo.", graficos: [], notas: [] },
    { k: "tirar", q: "Posso tirar antes?", f: null, r: tirar?.r ?? SEM_DADO, curto: "Tirar antes", num: tirar?.num ?? "Depende do título: veja a liquidez na corretora.", ajuda: "", graficos: [], notas: [] },
  ];
}

/** Nome curto da renda fixa na faixa da entrada: "CDB Banco Inter 105% CDI" vira "CDB Banco Inter". */
export function nomeCurtoRendaFixa(nome: string): string {
  return nome.replace(/\s+\d+([.,]\d+)?%\s*(do\s*)?CDI.*$/i, "").trim() || nome;
}

/* ----------------------------------------------------------------- comparar */

export type LinhaComparar = {
  rotulo: string;
  a: number | null;
  b: number | null;
  menorMelhor: boolean;
  formato: "pct" | "x" | "mi";
  /** Para magnitudes ("R$ 6,34 bi"): o texto como a fonte deu, encurtado. */
  textos?: [string | null, string | null];
};
export type GrupoComparar = { q: string; linhas: LinhaComparar[] };

/**
 * As linhas do Comparar (rodada 56, barras espelhadas): só números que os dois têm de verdade.
 * Linha com um lado sem dado fica com o "não tem" daquele lado; grupo sem nenhum número sai.
 */
export function gruposComparar(tipo: SheetType, a: Record<string, string>, b: Record<string, string>, extras?: { dyA: number | null; dyB: number | null }): GrupoComparar[] {
  a = semZerosFalsos(tipo, a);
  b = semZerosFalsos(tipo, b);
  const n = (ind: Record<string, string>, k: string) => (ind[k] ? parseIndicatorNumber(ind[k]) : null);
  // Magnitude só se compara na mesma moeda (VOO em dólar x IVVB11 em reais não se comparam assim).
  const moedaDe = (v: string | undefined) => (v && /US\$/.test(v) ? "USD" : "BRL");
  const m = (ind: Record<string, string>, k: string) => (ind[k] && moedaDe(a[k]) === moedaDe(b[k]) ? parseMagnitudeBRL(ind[k]) : null);
  const lin = (rotulo: string, k: string, menorMelhor: boolean, formato: LinhaComparar["formato"], get = n): LinhaComparar => {
    const va = get(a, k);
    const vb = get(b, k);
    return {
      rotulo,
      a: va,
      b: vb,
      menorMelhor,
      formato,
      ...(formato === "mi" ? { textos: [va !== null ? compactValue(a[k]) : null, vb !== null ? compactValue(b[k]) : null] as [string | null, string | null] } : {}),
    };
  };
  let grupos: GrupoComparar[];
  if (tipo === "FII") {
    grupos = [
      { q: "Paga bem?", linhas: [{ rotulo: "Pagou em 12 meses", a: extras?.dyA ?? null, b: extras?.dyB ?? null, menorMelhor: false, formato: "pct" }] },
      { q: "Caro ou barato?", linhas: [lin("Preço ÷ patrimônio", "p_vp", true, "x")] },
      { q: "Fácil de vender?", linhas: [lin("Negocia por dia", "liquidez_fii", false, "mi", m)] },
      { q: "Cobra muito?", linhas: [lin("Taxa de administração", "taxa_administracao", true, "pct")] },
    ];
  } else if (tipo === "ETF") {
    grupos = [
      { q: "Rendeu?", linhas: [lin("12 meses", "rentabilidade_12m", false, "pct"), lin("5 anos", "rentabilidade_5anos", false, "pct")] },
      { q: "É grande?", linhas: [lin("Patrimônio", "patrimonio_liquido_etf", false, "mi", m)] },
      { q: "Cobra quanto?", linhas: [lin("Taxa por ano", "taxa_administracao_etf", true, "pct")] },
    ];
  } else {
    grupos = [
      { q: "Ganha dinheiro?", linhas: [lin("Retorno dos sócios", "roe", false, "pct"), lin("Lucro em 5 anos", "evolucao_lucro", false, "pct")] },
      { q: "Paga bem?", linhas: [lin("Dividendos 12m", "dividend_yield", false, "pct")] },
      { q: "Cara ou barata?", linhas: [lin("Preço ÷ lucro", "p_l", true, "x"), lin("Preço ÷ patrimônio", "p_vp", true, "x")] },
      { q: "Deve muito?", linhas: [lin("Dívida ÷ caixa", "divida_liquida_ebitda", true, "x")] },
    ];
  }
  return grupos
    .map((g) => ({ ...g, linhas: g.linhas.filter((l) => l.a !== null || l.b !== null) }))
    .filter((g) => g.linhas.length > 0);
}

/** Qual lado vai melhor numa linha: "a", "b" ou null (empate ou falta um lado). */
export function quemVaiMelhor(l: LinhaComparar): "a" | "b" | null {
  if (l.a === null || l.b === null || l.a === l.b) return null;
  const aMelhor = l.menorMelhor ? l.a < l.b : l.a > l.b;
  return aMelhor ? "a" : "b";
}
