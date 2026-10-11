import { prisma } from "@/lib/db/prisma";
import {
  acharTitulo,
  cdiAoAno,
  chaveDoTitulo,
  FONTE_BCB,
  FONTE_TESOURO,
  ipcaDozeMeses,
  lerPrecosDoTesouro,
  lerSgs,
  SERIE_CDI,
  SERIE_IPCA,
  SERIE_SELIC,
  URL_SGS,
  URL_TESOURO_PRECOS,
} from "./fontes";

export const CHAVE_CDI = `bcb:${SERIE_CDI}`;
export const CHAVE_IPCA = `bcb:${SERIE_IPCA}`;
export const CHAVE_SELIC = `bcb:${SERIE_SELIC}`;

export type Indicador = {
  chave: string;
  /** CDI, IPCA e Selic em FRAÇÃO ao ano (0.1365); preço do título em reais. */
  valor: number;
  /** Só no Tesouro: a taxa de compra do dia, em % ao ano. */
  taxa: number | null;
  referenteA: Date;
  buscadoEm: Date;
  fonte: string;
};

function paraIndicador(l: { chave: string; valor: unknown; taxa: unknown; referenteA: Date; buscadoEm: Date; fonte: string }): Indicador {
  return { chave: l.chave, valor: Number(l.valor), taxa: l.taxa === null ? null : Number(l.taxa), referenteA: l.referenteA, buscadoEm: l.buscadoEm, fonte: l.fonte };
}

export async function lerIndicadores(chaves: string[]): Promise<Map<string, Indicador>> {
  if (chaves.length === 0) return new Map();
  const linhas = await prisma.indicadorExterno.findMany({ where: { chave: { in: chaves } } });
  return new Map(linhas.map((l) => [l.chave, paraIndicador(l)]));
}

/** Os títulos do Tesouro do último dia gravado (para achar o título do ativo pelo nome). */
export async function lerTitulosDoTesouro(): Promise<Indicador[]> {
  const linhas = await prisma.indicadorExterno.findMany({ where: { chave: { startsWith: "tesouro:" } } });
  return linhas.map(paraIndicador);
}

/** O título que casa com o nome do ativo ("Tesouro IPCA+ 2035"), se houver. */
export function tituloDoAtivo(nome: string, titulos: Indicador[]): Indicador | null {
  const chaves = titulos.map((t) => {
    const [, tipo, venc] = t.chave.split(":");
    return { tipo, vencimento: new Date(`${venc}T00:00:00Z`) };
  });
  const chave = acharTitulo(nome, chaves);
  return chave ? (titulos.find((t) => t.chave === chave) ?? null) : null;
}

async function gravar(chave: string, dados: { valor: number; taxa?: number | null; referenteA: Date; fonte: string }) {
  const agora = new Date();
  await prisma.indicadorExterno.upsert({
    where: { chave },
    create: { chave, valor: dados.valor, taxa: dados.taxa ?? null, referenteA: dados.referenteA, buscadoEm: agora, fonte: dados.fonte },
    update: { valor: dados.valor, taxa: dados.taxa ?? null, referenteA: dados.referenteA, buscadoEm: agora, fonte: dados.fonte },
  });
}

async function buscarJson(url: string, ms = 8000): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/**
 * CDI, IPCA e Selic do Banco Central. Cada série é independente: se uma falhar, as outras
 * gravam, e a que falhou continua com o último valor (a tela diz "de ontem"). Nunca lança.
 */
export async function atualizarTaxasDoBancoCentral(): Promise<Record<string, "ok" | "falhou">> {
  const r: Record<string, "ok" | "falhou"> = {};
  await Promise.all([
    (async () => {
      try {
        const pontos = lerSgs(await buscarJson(URL_SGS(SERIE_CDI, 5)));
        const ultimo = pontos[pontos.length - 1];
        if (!ultimo) throw new Error("vazio");
        await gravar(CHAVE_CDI, { valor: cdiAoAno(ultimo.valor), referenteA: ultimo.data, fonte: FONTE_BCB });
        r.cdi = "ok";
      } catch {
        r.cdi = "falhou";
      }
    })(),
    (async () => {
      try {
        const doze = ipcaDozeMeses(lerSgs(await buscarJson(URL_SGS(SERIE_IPCA, 12))));
        if (!doze) throw new Error("menos de 12 meses");
        await gravar(CHAVE_IPCA, { valor: doze.valor, referenteA: doze.ate, fonte: FONTE_BCB });
        r.ipca = "ok";
      } catch {
        r.ipca = "falhou";
      }
    })(),
    (async () => {
      try {
        const pontos = lerSgs(await buscarJson(URL_SGS(SERIE_SELIC, 1)));
        const ultimo = pontos[pontos.length - 1];
        if (!ultimo) throw new Error("vazio");
        // A série 432 vem datada até a próxima reunião do Copom: a referência é hoje, não essa data.
        const hoje = new Date();
        const ref = ultimo.data.getTime() > hoje.getTime() ? new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())) : ultimo.data;
        await gravar(CHAVE_SELIC, { valor: ultimo.valor / 100, referenteA: ref, fonte: FONTE_BCB });
        r.selic = "ok";
      } catch {
        r.selic = "falhou";
      }
    })(),
  ]);
  return r;
}

/**
 * Preço e taxa de cada título do Tesouro no último dia publicado. O arquivo é grande (cerca de
 * 15 MB, a história inteira), por isso só roda no cron diário. Nunca lança.
 */
export async function atualizarPrecosDoTesouro(): Promise<{ titulos: number } | { falhou: string }> {
  try {
    const resp = await fetch(URL_TESOURO_PRECOS, { signal: AbortSignal.timeout(45_000), cache: "no-store" });
    if (!resp.ok) return { falhou: `HTTP ${resp.status}` };
    const titulos = lerPrecosDoTesouro(await resp.text());
    if (titulos.length === 0) return { falhou: "arquivo sem títulos" };
    for (const t of titulos) {
      if (t.puVenda === null) continue;
      await gravar(chaveDoTitulo(t), { valor: t.puVenda, taxa: t.taxaCompra, referenteA: t.dataBase, fonte: FONTE_TESOURO });
    }
    return { titulos: titulos.length };
  } catch (e) {
    return { falhou: e instanceof Error ? e.message : "erro" };
  }
}

/** Busca o Banco Central de novo só se o que está gravado tem mais de 12 horas (ou não existe). */
export async function atualizarTaxasSeVelhas(agora: Date = new Date()): Promise<void> {
  const atuais = await lerIndicadores([CHAVE_CDI, CHAVE_IPCA, CHAVE_SELIC]);
  const velho = [CHAVE_CDI, CHAVE_IPCA, CHAVE_SELIC].some((c) => {
    const i = atuais.get(c);
    return !i || agora.getTime() - i.buscadoEm.getTime() > 12 * 60 * 60 * 1000;
  });
  if (velho) await atualizarTaxasDoBancoCentral();
}
