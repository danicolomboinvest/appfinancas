import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { brazilTodayUtc } from "@/lib/date/brazil-day";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { paysDividendsInReais } from "@/lib/analysis/dividend-scraper";
import { netValuePerShare } from "@/lib/analysis/dividend-tax";
import { resumirProventos, type EventoDeProvento } from "@/lib/portfolio/proventos";
import { CHAVE_CDI, CHAVE_IPCA, CHAVE_SELIC, lerIndicadores, lerTitulosDoTesouro, tituloDoAtivo, type Indicador } from "@/lib/indicadores/indicadores";
import { porcento, quandoDoIndicador } from "@/lib/indicadores/fontes";
import { colunasDoDetalhe } from "./colunas-de-proventos";

/** O que a tela mostra de um número de fora: o texto pronto, a fonte e o "quando". */
export type NumeroDeFora = { valor: string; fonte: string; quando: string; velho: boolean };

export function numeroDeFora(ind: Indicador | undefined, valor: (i: Indicador) => string, agora = new Date()): NumeroDeFora | null {
  if (!ind) return null;
  const q = quandoDoIndicador(ind, agora);
  return { valor: valor(ind), fonte: ind.fonte, quando: q.texto, velho: q.velho };
}

/** CDI, IPCA (12 meses) e Selic, com fonte e data. Sem a série gravada, null: a tela não mostra. */
export async function taxasDeReferencia(agora = new Date()) {
  const m = await lerIndicadores([CHAVE_CDI, CHAVE_IPCA, CHAVE_SELIC]);
  return {
    cdi: numeroDeFora(m.get(CHAVE_CDI), (i) => `${porcento(i.valor)} ao ano`, agora),
    ipca: numeroDeFora(m.get(CHAVE_IPCA), (i) => `${porcento(i.valor)} em 12 meses`, agora),
    selic: numeroDeFora(m.get(CHAVE_SELIC), (i) => `${porcento(i.valor)} ao ano`, agora),
    cdiFracao: m.get(CHAVE_CDI)?.valor ?? null,
    ipcaFracao: m.get(CHAVE_IPCA)?.valor ?? null,
  };
}

export type PrecoDoTitulo = { preco: number; taxa: number | null; tipo: string; fonte: string; quando: string; velho: boolean };

/** O preço e a taxa de hoje de cada título do Tesouro que ela tem, achado pelo nome do ativo. */
export async function precosDosTitulos(ativos: { id: string; name: string; assetClass: string }[], agora = new Date()): Promise<Record<string, PrecoDoTitulo>> {
  const doTesouro = ativos.filter((a) => a.assetClass === "TESOURO_DIRETO");
  if (doTesouro.length === 0) return {};
  const titulos = await lerTitulosDoTesouro();
  const r: Record<string, PrecoDoTitulo> = {};
  for (const a of doTesouro) {
    const t = tituloDoAtivo(a.name, titulos);
    if (!t) continue;
    const q = quandoDoIndicador(t, agora);
    r[a.id] = { preco: t.valor, taxa: t.taxa, tipo: t.chave.split(":")[1], fonte: t.fonte, quando: q.texto, velho: q.velho };
  }
  return r;
}

/** Os proventos dela: o resumo da aba e, por ticker, as colunas dos 12 meses (detalhe do ativo). */
export async function proventosDaCarteira(ctx: AuthContext) {
  const ativos = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, ticker: { not: null }, quantity: { not: null } },
    select: { ticker: true, quantity: true, investedValue: true },
  });
  const posicoes = ativos
    .filter((a) => a.ticker && paysDividendsInReais(a.ticker.toUpperCase()))
    .map((a) => ({ ticker: a.ticker!.toUpperCase(), quantidade: Number(a.quantity), investido: a.investedValue === null ? null : Number(a.investedValue) }));
  const hoje = brazilTodayUtc();
  const desde = new Date(Date.UTC(hoje.getUTCFullYear() - 1, hoje.getUTCMonth(), 1));
  const eventos: EventoDeProvento[] =
    posicoes.length === 0
      ? []
      : (
          await prisma.dividendEvent.findMany({
            where: { ticker: { in: [...new Set(posicoes.map((p) => p.ticker))] }, paymentDate: { gte: desde } },
            orderBy: { paymentDate: "asc" },
          })
        ).map((e) => ({ ticker: e.ticker, kind: e.kind, paymentDate: e.paymentDate, valuePerShare: Number(e.valuePerShare) }));
  const resumo = resumirProventos(eventos, posicoes, hoje);
  const porTicker: Record<string, { colunas: number[]; total: number }> = {};
  for (const t of new Set(posicoes.map((p) => p.ticker))) {
    const r = resumirProventos(eventos, posicoes.filter((p) => p.ticker === t), hoje);
    if (r.dozeMeses > 0) porTicker[t] = { colunas: colunasDoDetalhe(r.meses), total: r.dozeMeses };
  }
  // O que caiu HOJE (a linha discreta "Caiu R$ 50 de MXRF11 hoje", rodada 16).
  const qtd = new Map<string, number>();
  for (const p of posicoes) qtd.set(p.ticker, (qtd.get(p.ticker) ?? 0) + p.quantidade);
  const caiuHoje = eventos
    .filter((e) => e.paymentDate.getTime() === hoje.getTime() && qtd.has(e.ticker.toUpperCase()))
    .map((e) => ({ ticker: e.ticker.toUpperCase(), valor: Math.round(qtd.get(e.ticker.toUpperCase())! * netValuePerShare(e.kind, e.valuePerShare) * 100) / 100 }));
  return { resumo, porTicker, caiuHoje, hoje };
}

/** Uma ponta por mês dos últimos 12 meses (o último registro de cada mês), para a linha fina do herói. */
export async function evolucaoDoPatrimonio(ctx: AuthContext): Promise<{ rotulo: string; valor: number }[]> {
  const agora = nowInBrazil();
  const desde = new Date(Date.UTC(agora.getFullYear() - 1, agora.getMonth(), 1));
  const fotos = await prisma.patrimonySnapshot.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, date: { gte: desde } },
    orderBy: { date: "asc" },
    select: { date: true, totalValue: true },
  });
  const porMes = new Map<string, { data: Date; valor: number }>();
  for (const f of fotos) porMes.set(`${f.date.getUTCFullYear()}-${f.date.getUTCMonth()}`, { data: f.date, valor: Number(f.totalValue) });
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return [...porMes.values()].map((p) => ({ rotulo: `${MES[p.data.getUTCMonth()]} ${p.data.getUTCFullYear()}`, valor: p.valor }));
}

/** Os títulos do Tesouro à venda hoje, para a busca do Novo ativo ("Tesouro IPCA+ 2035"). */
export async function titulosParaABusca(agora = new Date()) {
  const titulos = await lerTitulosDoTesouro();
  return titulos
    .map((t) => {
      const [, tipo, venc] = t.chave.split(":");
      const ano = venc.slice(0, 4);
      const nome = `${tipo.replace(" com Juros Semestrais", " com juros")} ${ano}`;
      const q = quandoDoIndicador(t, agora);
      return { nome, tipo, preco: t.valor, taxa: t.taxa, fonte: t.fonte, quando: q.texto, velho: q.velho, venc };
    })
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.venc.localeCompare(b.venc))
    .map(({ nome, tipo, preco, taxa, fonte, quando, velho }) => ({ nome, tipo, preco, taxa, fonte, quando, velho }));
}
