import { prisma } from "@/lib/db/prisma";
import { FONTE_BCB, lerSgs, SERIE_CDI, SERIE_IPCA, type PontoSgs } from "./fontes";

/**
 * As séries históricas que o rendimento da renda fixa usa (tabela SerieIndice, 15/10/2026):
 * - "cdi": SGS 12, o CDI de cada dia útil em % ao dia;
 * - "ipca": SGS 433, o IPCA de cada mês em % ao mês (datado no dia 1 do mês).
 *
 * A SGS recusa (HTTP 406) consulta de série diária com mais de 10 anos entre a data inicial e a
 * final: a busca vai em janelas de 5 anos. A carga inicial é scripts/carregar-series-indices.ts;
 * o cron de indicadores chama `atualizarSeries` todo dia útil e traz só o que falta.
 */

export type NomeDaSerie = "cdi" | "ipca";
export const CODIGO_SGS: Record<NomeDaSerie, number> = { cdi: SERIE_CDI, ipca: SERIE_IPCA };

/** Janela de cada consulta, em anos (o teto da SGS é 10). */
export const ANOS_POR_CONSULTA = 5;

const ddmmaaaa = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

export const URL_SGS_PERIODO = (serie: number, de: Date, ate: Date) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${ddmmaaaa(de)}&dataFinal=${ddmmaaaa(ate)}`;

/** As janelas [de, ate] de no máximo ANOS_POR_CONSULTA anos que cobrem o período. */
export function janelas(de: Date, ate: Date, anos = ANOS_POR_CONSULTA): { de: Date; ate: Date }[] {
  const r: { de: Date; ate: Date }[] = [];
  let ini = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate()));
  const fim = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate()));
  while (ini.getTime() <= fim.getTime()) {
    const corte = new Date(Date.UTC(ini.getUTCFullYear() + anos, ini.getUTCMonth(), ini.getUTCDate() - 1));
    const f = corte.getTime() < fim.getTime() ? corte : fim;
    r.push({ de: ini, ate: f });
    ini = new Date(f.getTime() + 24 * 60 * 60 * 1000);
  }
  return r;
}

type Buscar = (url: string) => Promise<unknown>;

async function buscarJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" }, cache: "no-store" });
  // A SGS devolve 404 com "Value(s) not found" quando a janela não tem nenhum ponto (um fim de semana).
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** A série inteira do período, janela por janela, uma de cada vez (sem martelar a SGS). */
export async function buscarSeriePorPeriodo(serie: NomeDaSerie, de: Date, ate: Date, buscar: Buscar = buscarJson): Promise<PontoSgs[]> {
  const pontos: PontoSgs[] = [];
  for (const j of janelas(de, ate)) pontos.push(...lerSgs(await buscar(URL_SGS_PERIODO(CODIGO_SGS[serie], j.de, j.ate))));
  const unicos = new Map(pontos.map((p) => [p.data.getTime(), p]));
  return [...unicos.values()].sort((a, b) => a.data.getTime() - b.data.getTime());
}

/** Grava (ou corrige, se o BC revisou) os pontos. Em lotes, numa conexão só. */
export async function gravarSerie(serie: NomeDaSerie, pontos: PontoSgs[]): Promise<number> {
  if (pontos.length === 0) return 0;
  const existentes = await prisma.serieIndice.findMany({
    where: { indice: serie, data: { gte: pontos[0].data, lte: pontos[pontos.length - 1].data } },
    select: { data: true, valor: true },
  });
  const ja = new Map(existentes.map((e) => [e.data.getTime(), Number(e.valor)]));
  const novos = pontos.filter((p) => !ja.has(p.data.getTime()));
  const mudaram = pontos.filter((p) => ja.has(p.data.getTime()) && Math.abs(ja.get(p.data.getTime())! - p.valor) > 1e-9);
  for (let i = 0; i < novos.length; i += 1000) {
    await prisma.serieIndice.createMany({ data: novos.slice(i, i + 1000).map((p) => ({ indice: serie, data: p.data, valor: p.valor, fonte: FONTE_BCB })), skipDuplicates: true });
  }
  for (const p of mudaram) await prisma.serieIndice.update({ where: { indice_data: { indice: serie, data: p.data } }, data: { valor: p.valor } });
  return novos.length + mudaram.length;
}

/**
 * O que falta de cada série, do último ponto gravado (menos uma folga, para pegar revisões) até
 * hoje. Sem nada gravado, não faz a carga inicial (é grande demais para o cron): devolve
 * "sem carga" e o cálculo do rendimento não mexe em nada até o script rodar. Nunca lança.
 */
export async function atualizarSeries(hoje: Date = new Date(), buscar: Buscar = buscarJson): Promise<Record<NomeDaSerie, number | "sem carga" | "falhou">> {
  const r = {} as Record<NomeDaSerie, number | "sem carga" | "falhou">;
  for (const serie of ["cdi", "ipca"] as const) {
    try {
      const ultimo = await prisma.serieIndice.findFirst({ where: { indice: serie }, orderBy: { data: "desc" }, select: { data: true } });
      if (!ultimo) {
        r[serie] = "sem carga";
        continue;
      }
      const folgaEmDias = serie === "cdi" ? 10 : 70;
      const de = new Date(ultimo.data.getTime() - folgaEmDias * 24 * 60 * 60 * 1000);
      r[serie] = await gravarSerie(serie, await buscarSeriePorPeriodo(serie, de, hoje, buscar));
    } catch {
      r[serie] = "falhou";
    }
  }
  return r;
}

/** As duas séries desde um dia, em % (como no banco). */
export async function lerSeries(desde: Date): Promise<Record<NomeDaSerie, { data: Date; valor: number }[]>> {
  // O IPCA é por mês: desde o dia 1 do mês, senão o mês da compra ficava de fora.
  const desdeMes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const [cdi, ipca] = await Promise.all([
    prisma.serieIndice.findMany({ where: { indice: "cdi", data: { gte: desde } }, orderBy: { data: "asc" }, select: { data: true, valor: true } }),
    prisma.serieIndice.findMany({ where: { indice: "ipca", data: { gte: desdeMes } }, orderBy: { data: "asc" }, select: { data: true, valor: true } }),
  ]);
  const num = (l: { data: Date; valor: unknown }[]) => l.map((x) => ({ data: x.data, valor: Number(x.valor) }));
  return { cdi: num(cdi), ipca: num(ipca) };
}
