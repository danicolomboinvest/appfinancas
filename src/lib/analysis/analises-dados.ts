import type { Asset, SheetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { isLaudo, type Laudo } from "./laudo";
import { nomeConhecido } from "./tipo-do-ticker";
import { geralDoAtivo, nomeCurtoRendaFixa, perguntasDoAtivo, perguntasRendaFixa, type Forca, type Pergunta, type Provento } from "./quatro-perguntas";

/**
 * Os dados das Análises da versão nova, lidos do banco: a carteira da pessoa, a leitura mais nova
 * de cada ticker (o laudo guardado na ficha) e o histórico de proventos. Nada é raspado aqui; o que
 * falta ler vai na lista `pendentes`, e a tela lê um por vez (lerAtivoAction).
 */

/** Leitura mais velha que isso é lida de novo ao abrir as Análises (os números mudam todo dia). */
export const LEITURA_VALE_MS = 7 * 24 * 3_600_000;

export type Logo = { slug: string; src: string; cor: string; mono: boolean; cheio?: boolean } | null;

export type AtivoAnalisado = {
  ticker: string;
  nome: string;
  tipo: SheetType;
  /** % da carteira (0 a 100). */
  peso: number;
  perguntas: Pergunta[];
  geral: Forca | null;
  logo: Logo;
  lidoEm: string | null;
};

export type LinhaRendaFixa = { id: string; nome: string; nomeCurto: string; peso: number; logo: Logo; tesouro: boolean };
export type LinhaSemAnalise = { id: string; nome: string; peso: number; lendo: boolean };

export type DadosDasAnalises = {
  total: number;
  ativos: AtivoAnalisado[];
  rendaFixa: LinhaRendaFixa[];
  /** Ativos com ticker que ainda não têm leitura (ou que a leitura falhou) e os sem análise possível. */
  outros: LinhaSemAnalise[];
  /** O que a tela ainda precisa ler: ticker e tipo da análise. */
  pendentes: { ticker: string; tipo: SheetType }[];
};

function tickerDe(a: Pick<Asset, "ticker" | "name">): string {
  return (a.ticker ?? a.name).trim().toUpperCase();
}

/**
 * O tipo de análise de um ativo da carteira. Ação vira ficha de ação; FII, de FII; exterior em
 * dólar ou ETF da B3 (final 11), de ETF. BDR (final 34, 35, 39), fundo, cripto e outros ficam
 * sem análise: melhor não ter do que usar a régua errada.
 */
export function tipoDaAnalise(a: Pick<Asset, "assetClass" | "ticker" | "currency">): SheetType | null {
  const t = (a.ticker ?? "").trim().toUpperCase();
  if (!t) return null;
  if (a.assetClass === "ACAO") return /^[A-Z]{4}\d{1,2}$/.test(t) ? "STOCK" : null;
  if (a.assetClass === "FII") return /^[A-Z]{4}11$/.test(t) ? "FII" : null;
  if (a.assetClass === "INTERNACIONAL") {
    if (/^[A-Z]{4}11$/.test(t)) return "ETF";
    if (/^[A-Z]{1,5}$/.test(t)) return "ETF";
    return null;
  }
  return null;
}

/** Os indicadores de volta do laudo guardado (cada item traz a chave e o valor como a fonte deu). */
export function indicadoresDoLaudo(laudo: Laudo): Record<string, string> {
  const ind: Record<string, string> = {};
  for (const s of laudo.sections) for (const i of s.items) ind[i.key] = i.value;
  return ind;
}

export function logoDe(...nomes: (string | null | undefined)[]): Logo {
  for (const n of nomes) {
    const m = marcaDaDescricao(n);
    if (m) return { slug: m.slug, src: m.src, cor: m.cor, mono: m.mono, ...(m.cheio ? { cheio: true } : {}) };
  }
  return null;
}

type FichaLida = { id: string; ticker: string; sheetType: SheetType; companyName: string | null; laudo: Laudo | null; laudoReadAt: Date | null };

/** A ficha mais nova de cada ticker (com leitura, se houver), deste perfil. */
export async function fichasPorTicker(ctx: AuthContext, tickers?: string[]): Promise<Map<string, FichaLida>> {
  const fichas = await prisma.analysisSheet.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, ...(tickers ? { ticker: { in: tickers, mode: "insensitive" } } : {}) },
    orderBy: [{ laudoReadAt: { sort: "desc", nulls: "last" } }, { analysisDate: "desc" }],
    select: { id: true, ticker: true, sheetType: true, companyName: true, laudo: true, laudoReadAt: true },
  });
  const mapa = new Map<string, FichaLida>();
  for (const f of fichas) {
    const k = f.ticker.trim().toUpperCase();
    const atual = mapa.get(k);
    const laudo = isLaudo(f.laudo) ? f.laudo : null;
    if (!atual || (!atual.laudo && laudo)) mapa.set(k, { ...f, laudo });
  }
  return mapa;
}

/** O histórico de proventos por cota de cada ticker (DividendEvent, guardado por ticker). */
export async function proventosDe(tickers: string[]): Promise<Map<string, Provento[]>> {
  const mapa = new Map<string, Provento[]>();
  if (tickers.length === 0) return mapa;
  const eventos = await prisma.dividendEvent.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, paymentDate: true, valuePerShare: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const e of eventos) {
    const lista = mapa.get(e.ticker) ?? [];
    lista.push({ pagamento: e.paymentDate, valor: Number(e.valuePerShare) });
    mapa.set(e.ticker, lista);
  }
  return mapa;
}

/** Cotação unitária na moeda do ativo: a da Carteira; sem ela, o último preço do dia guardado. */
export function cotacaoDoAtivo(a: Pick<Asset, "currency" | "currentUnitPrice" | "nativeCurrentValue" | "quantity">): number | null {
  if (a.currency !== "BRL") {
    const q = a.quantity ? Number(a.quantity) : 0;
    return a.nativeCurrentValue && q > 0 ? Number(a.nativeCurrentValue) / q : null;
  }
  return a.currentUnitPrice ? Number(a.currentUnitPrice) : null;
}

export async function ultimoPrecoDoDia(ticker: string): Promise<{ preco: number; data: Date } | null> {
  const p = await prisma.precoDiario.findFirst({ where: { ticker: ticker.toUpperCase() }, orderBy: { data: "desc" }, select: { preco: true, data: true } });
  return p ? { preco: Number(p.preco), data: p.data } : null;
}

export async function carregarAnalises(ctx: AuthContext, hoje = new Date()): Promise<DadosDasAnalises> {
  const assets = await listAssets(ctx);
  const total = assets.reduce((t, a) => t + Number(a.currentValue), 0);
  const peso = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  // Agrupa por ticker: o mesmo ativo em duas linhas (duas corretoras) é um anel só.
  const grupos = new Map<string, Asset[]>();
  const rendaFixa: LinhaRendaFixa[] = [];
  const outros: LinhaSemAnalise[] = [];
  for (const a of assets) {
    if (a.assetClass === "RENDA_FIXA" || a.assetClass === "TESOURO_DIRETO") {
      rendaFixa.push({
        id: a.id,
        nome: a.name,
        nomeCurto: nomeCurtoRendaFixa(a.name),
        peso: peso(Number(a.currentValue)),
        logo: logoDe(a.name),
        tesouro: a.assetClass === "TESOURO_DIRETO" || /tesouro/i.test(a.name),
      });
      continue;
    }
    const tipo = tipoDaAnalise(a);
    if (!tipo) {
      outros.push({ id: a.id, nome: a.ticker || a.name, peso: peso(Number(a.currentValue)), lendo: false });
      continue;
    }
    const k = tickerDe(a);
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }

  const tickers = [...grupos.keys()];
  const [fichas, proventos] = await Promise.all([fichasPorTicker(ctx, tickers), proventosDe(tickers)]);

  const ativos: AtivoAnalisado[] = [];
  const pendentes: { ticker: string; tipo: SheetType }[] = [];
  for (const [ticker, lista] of grupos) {
    const a = lista[0];
    const valor = lista.reduce((t, x) => t + Number(x.currentValue), 0);
    const ficha = fichas.get(ticker);
    const tipo = ficha?.sheetType ?? tipoDaAnalise(a)!;
    const velha = !ficha?.laudoReadAt || hoje.getTime() - ficha.laudoReadAt.getTime() > LEITURA_VALE_MS;
    if (!ficha?.laudo || velha) pendentes.push({ ticker, tipo });
    if (!ficha?.laudo) {
      outros.push({ id: a.id, nome: ticker, peso: peso(valor), lendo: true });
      continue;
    }
    const perguntas = perguntasDoAtivo({
      tipo,
      ticker,
      indicadores: indicadoresDoLaudo(ficha.laudo),
      cotacao: cotacaoDoAtivo(a),
      moeda: a.currency === "USD" ? "USD" : "BRL",
      proventos: proventos.get(ticker) ?? [],
      hoje,
    });
    ativos.push({
      ticker,
      nome: ficha.companyName || nomeConhecido(ticker) || a.name,
      tipo,
      peso: peso(valor),
      perguntas,
      geral: geralDoAtivo(perguntas),
      logo: logoDe(ficha.companyName, nomeConhecido(ticker), a.name),
      lidoEm: ficha.laudoReadAt?.toISOString() ?? null,
    });
  }

  ativos.sort((x, y) => y.peso - x.peso);
  rendaFixa.sort((x, y) => y.peso - x.peso);
  outros.sort((x, y) => y.peso - x.peso);
  return { total, ativos, rendaFixa, outros, pendentes };
}

/** A renda fixa de um ativo da pessoa, para a Análise completa do título. */
export async function analiseDaRendaFixa(ctx: AuthContext, id: string) {
  const assets = await listAssets(ctx);
  const a = assets.find((x) => x.id === id && (x.assetClass === "RENDA_FIXA" || x.assetClass === "TESOURO_DIRETO"));
  if (!a) return null;
  const total = assets.reduce((t, x) => t + Number(x.currentValue), 0);
  return {
    id: a.id,
    nome: a.name,
    valor: Number(a.currentValue),
    investido: a.investedValue ? Number(a.investedValue) : null,
    peso: total > 0 ? (Number(a.currentValue) / total) * 100 : 0,
    logo: logoDe(a.name),
    perguntas: perguntasRendaFixa({ nome: a.name, classe: a.assetClass as "RENDA_FIXA" | "TESOURO_DIRETO", indexador: a.fixedIncomeIndex }),
  };
}
