import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { brazilTodayUtc } from "@/lib/date/brazil-day";
import { processarComPrazo } from "@/lib/cron/lote";
import { lerTitulosDoTesouro, tituloDoAtivo, type Indicador } from "@/lib/indicadores/indicadores";
import { lerSeries } from "@/lib/indicadores/series";
import { dataDoDia, dia, diaDe } from "./calendario-anbima";
import { rendimentoDoAtivo, serieEmFracao, type Series } from "./rendimento-renda-fixa";
import { recordPatrimonySnapshotIfNeeded } from "./snapshot";

/**
 * Grava no Asset.currentValue o rendimento da renda fixa e do Tesouro (15/10/2026), com a conta de
 * rendimento-renda-fixa.ts. Quem chama: o cron de indicadores (todo mundo, em lotes, com prazo), a
 * abertura da Carteira (só a pessoa, se o cálculo é de antes de hoje) e o salvar do ativo.
 *
 * Só a conta em reais de quem usa o app em reais: CDI e IPCA não valem para um depósito em euro.
 */

/** Os ativos que este cálculo acompanha. */
export const ONDE_RENDA_FIXA: Prisma.AssetWhereInput = {
  assetClass: { in: ["RENDA_FIXA", "TESOURO_DIRETO"] },
  currency: "BRL",
  user: { currency: "BRL" },
};

const CAMPOS = {
  id: true,
  userId: true,
  profileId: true,
  name: true,
  assetClass: true,
  fixedIncomeIndex: true,
  taxaCompra: true,
  investedValue: true,
  currentValue: true,
  quantity: true,
  acquisitionDate: true,
  valorInformado: true,
  valorInformadoEm: true,
  rendimentoReferenteA: true,
  rendimentoComo: true,
  rendimentoEstimado: true,
} satisfies Prisma.AssetSelect;

type AtivoLido = Prisma.AssetGetPayload<{ select: typeof CAMPOS }>;

type Alocacao = { assetId: string; amount: unknown; createdAt: Date; entry: { entryDate: Date | null; year: number; month: number } };

/** O dia de um aporte ou resgate: a data do lançamento; sem ela, o dia em que ela registrou, no máximo o fim do mês do lançamento. */
export function diaDoMovimento(a: { createdAt: Date; entry: { entryDate: Date | null; year: number; month: number } }): number {
  if (a.entry.entryDate) return diaDe(a.entry.entryDate);
  const fimDoMes = dia(a.entry.year, a.entry.month + 1, 1) - 1;
  return Math.min(diaDe(brazilTodayUtc(a.createdAt)), fimDoMes);
}

export type Calculo = {
  currentValue: number | null;
  rendimentoReferenteA: Date | null;
  rendimentoComo: string | null;
  rendimentoEstimado: boolean;
};

/** A conta de um ativo já lido, sem banco. currentValue null = não dá para calcular, fica como está. */
export function calcularAtivo(a: AtivoLido, alocacoes: Alocacao[], series: Series, titulos: Indicador[], hoje: number): Calculo {
  const nada: Calculo = { currentValue: null, rendimentoReferenteA: null, rendimentoComo: null, rendimentoEstimado: false };
  // Tesouro com a quantidade de títulos: o preço do dia (Tesouro Transparente), como no detalhe.
  if (a.assetClass === "TESOURO_DIRETO" && a.quantity !== null && Number(a.quantity) > 0) {
    const t = tituloDoAtivo(a.name, titulos);
    if (t) return { currentValue: Math.round(Number(a.quantity) * t.valor * 100) / 100, rendimentoReferenteA: t.referenteA, rendimentoComo: "tesouro", rendimentoEstimado: false };
  }
  const informadoEm = a.valorInformadoEm;
  const r = rendimentoDoAtivo({
    ativo: {
      name: a.name,
      assetClass: a.assetClass,
      fixedIncomeIndex: a.fixedIncomeIndex,
      taxaCompra: a.taxaCompra === null ? null : Number(a.taxaCompra),
      investedValue: a.investedValue === null ? null : Number(a.investedValue),
    },
    compra: a.acquisitionDate ? diaDe(a.acquisitionDate) : null,
    informado: informadoEm && a.valorInformado !== null ? { dia: diaDe(brazilTodayUtc(informadoEm)), valor: Number(a.valorInformado) } : null,
    movimentos: alocacoes.map((m) => ({ dia: diaDoMovimento(m), valor: Number(m.amount), depoisDoInformado: informadoEm ? m.createdAt.getTime() > informadoEm.getTime() : true })),
    series,
    ate: hoje,
  });
  if (!r) return nada;
  return { currentValue: r.valor, rendimentoReferenteA: dataDoDia(r.referenteA), rendimentoComo: r.como, rendimentoEstimado: r.estimado };
}

/** O dia de onde as séries precisam começar para estes ativos. */
function desdeQuando(ativos: Pick<AtivoLido, "acquisitionDate" | "valorInformadoEm">[]): Date | null {
  let menor: number | null = null;
  for (const a of ativos) {
    const d = a.valorInformadoEm ? diaDe(brazilTodayUtc(a.valorInformadoEm)) : a.acquisitionDate ? diaDe(a.acquisitionDate) : null;
    if (d !== null && (menor === null || d < menor)) menor = d;
  }
  // Uma semana antes: o fatorCdi confere que a série cobre a data (feriado, fim de semana).
  return menor === null ? null : dataDoDia(menor - 7);
}

export type ResultadoDoLote = { ativos: number; mudaram: number; semCalculo: number; perfis: Set<string> };

/**
 * Calcula e grava um lote de ativos. Lê as séries uma vez para o lote e os aportes e resgates de
 * todos numa consulta só. Grava todo ativo do lote (para a data do cálculo andar), mas só mexe no
 * currentValue quando a conta saiu.
 */
export async function recalcularLote(ativos: AtivoLido[], agora: Date, contexto?: { series?: Series; titulos?: Indicador[] }): Promise<ResultadoDoLote> {
  const res: ResultadoDoLote = { ativos: ativos.length, mudaram: 0, semCalculo: 0, perfis: new Set() };
  if (ativos.length === 0) return res;
  const hoje = diaDe(brazilTodayUtc(agora));
  const desde = desdeQuando(ativos);
  let series = contexto?.series;
  if (!series) {
    const lidas = desde ? await lerSeries(desde) : { cdi: [], ipca: [] };
    series = { cdi: serieEmFracao(lidas.cdi), ipca: serieEmFracao(lidas.ipca) };
  }
  const titulos = contexto?.titulos ?? (ativos.some((a) => a.assetClass === "TESOURO_DIRETO") ? await lerTitulosDoTesouro() : []);
  const alocacoes = await prisma.contributionAllocation.findMany({
    where: { assetId: { in: ativos.map((a) => a.id) } },
    select: { assetId: true, amount: true, createdAt: true, entry: { select: { entryDate: true, year: true, month: true } } },
  });
  const porAtivo = new Map<string, Alocacao[]>();
  for (const m of alocacoes) porAtivo.set(m.assetId, [...(porAtivo.get(m.assetId) ?? []), m]);

  const gravar = ativos.map((a) => {
    const c = calcularAtivo(a, porAtivo.get(a.id) ?? [], series!, titulos, hoje);
    if (c.currentValue === null) res.semCalculo += 1;
    else if (Math.abs(c.currentValue - Number(a.currentValue)) >= 0.005) {
      res.mudaram += 1;
      if (a.profileId) res.perfis.add(`${a.userId}:${a.profileId}`);
    }
    return prisma.asset.update({
      where: { id: a.id },
      data: {
        rendimentoCalculadoEm: agora,
        rendimentoReferenteA: c.rendimentoReferenteA,
        rendimentoComo: c.rendimentoComo,
        rendimentoEstimado: c.rendimentoEstimado,
        ...(c.currentValue !== null ? { currentValue: c.currentValue } : {}),
      },
      select: { id: true },
    });
  });
  // Uma transação por lote: uma conexão, e o lote grava inteiro ou nada.
  await prisma.$transaction(gravar);
  return res;
}

/** A foto do patrimônio de hoje de quem mudou (a linha de evolução anda sem ela abrir a Carteira). */
async function fotografarPerfis(perfis: Set<string>) {
  for (const chave of perfis) {
    const [userId, profileId] = chave.split(":");
    const soma = await prisma.asset.aggregate({ where: { userId, profileId }, _sum: { currentValue: true } });
    const total = Number(soma._sum.currentValue ?? 0);
    if (total > 0) await recordPatrimonySnapshotIfNeeded({ userId, profileId }, Math.round(total * 100) / 100);
  }
}

/**
 * Todo mundo, para o cron: os mais velhos primeiro (quem ficou para trás ontem passa na frente),
 * em lotes de `tamanho`, `paralelo` lotes por vez, parando de pegar lote novo no `prazo`.
 */
export async function recalcularRendaFixaDeTodos(opcoes: { agora?: Date; prazo: number; tamanho?: number; paralelo?: number }): Promise<{ ativos: number; mudaram: number; semCalculo: number; pendentes: number; perfis: number }> {
  const agora = opcoes.agora ?? new Date();
  const tamanho = opcoes.tamanho ?? 100;
  const ids = await prisma.asset.findMany({
    where: ONDE_RENDA_FIXA,
    orderBy: [{ rendimentoCalculadoEm: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    select: { id: true },
  });
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += tamanho) lotes.push(ids.slice(i, i + tamanho).map((x) => x.id));
  const total = { ativos: 0, mudaram: 0, semCalculo: 0, perfis: new Set<string>() };
  // Séries e títulos lidos uma vez para todos os lotes (os lotes só leem os próprios aportes).
  const todos = await prisma.asset.findMany({ where: ONDE_RENDA_FIXA, select: { acquisitionDate: true, valorInformadoEm: true } });
  const desde = desdeQuando(todos);
  const lidas = desde ? await lerSeries(desde) : { cdi: [], ipca: [] };
  const series: Series = { cdi: serieEmFracao(lidas.cdi), ipca: serieEmFracao(lidas.ipca) };
  const titulos = await lerTitulosDoTesouro();
  const r = await processarComPrazo(lotes, { paralelo: opcoes.paralelo ?? 2, prazo: opcoes.prazo }, async (lote) => {
    const ativos = await prisma.asset.findMany({ where: { id: { in: lote } }, select: CAMPOS });
    const x = await recalcularLote(ativos, agora, { series, titulos });
    total.ativos += x.ativos;
    total.mudaram += x.mudaram;
    total.semCalculo += x.semCalculo;
    for (const p of x.perfis) total.perfis.add(p);
  });
  await fotografarPerfis(total.perfis).catch(() => undefined);
  const pendentes = ids.length - total.ativos;
  return { ativos: total.ativos, mudaram: total.mudaram, semCalculo: total.semCalculo, pendentes: Math.max(pendentes, r.pendentes), perfis: total.perfis.size };
}

/**
 * Abrir a Carteira: recalcula os ativos dela se algum ainda não foi calculado hoje (o mesmo
 * espírito do atualizarTaxasSeVelhas). Barato quando está em dia: uma contagem.
 */
export async function atualizarRendaFixaSeVelha(ctx: Pick<AuthContext, "userId" | "profileId">, agora: Date = new Date()): Promise<boolean> {
  const inicioDoDia = brazilDayStartInstant(agora);
  const onde: Prisma.AssetWhereInput = { ...ONDE_RENDA_FIXA, userId: ctx.userId, profileId: ctx.profileId };
  const velhos = await prisma.asset.count({ where: { ...onde, OR: [{ rendimentoCalculadoEm: null }, { rendimentoCalculadoEm: { lt: inicioDoDia } }] } });
  if (velhos === 0) return false;
  const ativos = await prisma.asset.findMany({ where: onde, select: CAMPOS });
  await recalcularLote(ativos, agora);
  return true;
}

/** Recalcula um ativo só (depois de salvar o ativo). Não lança: o valor salvo continua valendo. */
export async function recalcularUmAtivo(ctx: Pick<AuthContext, "userId" | "profileId">, id: string, agora: Date = new Date()): Promise<void> {
  try {
    const ativos = await prisma.asset.findMany({ where: { ...ONDE_RENDA_FIXA, id, userId: ctx.userId, profileId: ctx.profileId }, select: CAMPOS });
    await recalcularLote(ativos, agora);
  } catch (e) {
    console.error("[rendimento] recalcular ativo", e);
  }
}

/** O instante (UTC) em que começou o dia de hoje em Brasília. */
export function brazilDayStartInstant(agora: Date): Date {
  const hoje = brazilTodayUtc(agora);
  // Brasília é UTC−3 o ano todo desde 2019 (sem horário de verão).
  return new Date(hoje.getTime() + 3 * 60 * 60 * 1000);
}
