import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import type { QuemLe } from "@/lib/casa/regras";
import { chaveRaioX, type RaioXItem } from "@/lib/decisoes/raio-x";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { carregarRespostasDeAssinatura, itensDoRaioX, type RespostasDeAssinatura } from "./respostas";
import { chaveDaIdentidade, estadoDaAssinatura, marcasDoRaioX } from "./regra";
import {
  TIPO_DO_LEMBRETE,
  avisoDeHoje,
  diaDaCobranca,
  lembreteDaLinha,
  lembreteQueVale,
  type CobrancaDaAssinatura,
  type DadosDoLembrete,
  type LembreteDeAssinatura,
  type LembreteNaTela,
} from "./lembrete";

export type { LembreteNaTela };

/**
 * O banco do lembrete de cancelar (lembrete.ts): lê e grava as linhas "assinatura_lembrete" da
 * tabela Decisao, e lê do histórico de lançamentos o dia em que cada assinatura cobra.
 *
 * Casal simples: o lembrete é só de quem pediu. Só as linhas da própria pessoa são lidas, e o
 * histórico é só o dela.
 */

type Dono = { userId: string; profileId: string };
const donoDe = (q: Dono): Dono => ({ userId: q.userId, profileId: q.profileId });

/** As linhas de lembrete da pessoa (só dela), da mais antiga à mais nova. */
export async function carregarLembretes(dono: Dono): Promise<LembreteDeAssinatura[]> {
  const linhas = await prisma.decisao.findMany({
    where: { ...donoDe(dono), tipo: TIPO_DO_LEMBRETE },
    select: { id: true, descricao: true, dados: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });
  return linhas.map(lembreteDaLinha).filter((l): l is LembreteDeAssinatura => l !== null);
}

/** Meses de histórico para achar o dia da cobrança (o atual e os 6 de antes). */
const MESES_DO_HISTORICO = 7;

export type Historico = {
  /** Todas as cobranças até hoje, por chave do Raio-X (para o dia). */
  todas: Map<string, CobrancaDaAssinatura[]>;
  /** Só as que vieram de verdade (sem as cópias lançadas adiantado), para "a cobrança veio?". */
  reais: Map<string, CobrancaDaAssinatura[]>;
  /** O dia do lançamento mais recente que ela trouxe: até onde o histórico enxerga. */
  dadosAte: Date | null;
};

/**
 * As cobranças de cada assinatura nos últimos meses, só da pessoa. A cópia da despesa recorrente
 * lançada antes do mês dela (sem extrato) não é cobrança que "veio": é o app adiantando.
 */
export async function historicoDasCobrancas(dono: Dono, chaves: readonly string[], hoje: Date): Promise<Historico> {
  const fim = hoje.getUTCFullYear() * 12 + hoje.getUTCMonth();
  const meses = Array.from({ length: MESES_DO_HISTORICO }, (_, i) => fim - i).map((m) => ({ year: Math.floor(m / 12), month: (m % 12) + 1 }));
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...donoDe(dono), category: "EXPENSE", OR: meses },
    select: { description: true, amount: true, entryDate: true, year: true, month: true, createdAt: true, importBatchId: true, externalId: true },
    take: 10_000,
  });
  const quero = new Set(chaves);
  const todas = new Map<string, CobrancaDaAssinatura[]>();
  const reais = new Map<string, CobrancaDaAssinatura[]>();
  let dadosAte: Date | null = null;
  const limite = hoje.getTime();
  for (const l of linhas) {
    if (l.entryDate && l.entryDate.getTime() > limite) continue;
    const adiantada = !l.importBatchId && !l.externalId && l.createdAt.getTime() < Date.UTC(l.year, l.month - 1, 1, 3);
    if (!adiantada && l.entryDate && (!dadosAte || l.entryDate.getTime() > dadosAte.getTime())) dadosAte = l.entryDate;
    if (!l.description) continue;
    const k = chaveRaioX(l.description);
    if (!quero.has(k)) continue;
    const c: CobrancaDaAssinatura = { data: l.entryDate, valor: Number(l.amount), year: l.year, month: l.month };
    todas.set(k, [...(todas.get(k) ?? []), c]);
    if (!adiantada) reais.set(k, [...(reais.get(k) ?? []), c]);
  }
  return { todas, reais, dadosAte };
}

/** "Ainda não" respondido ao "Cancelou?" neste mês: o app não pergunta de novo até o mês virar. */
export async function respondidasAindaNao(dono: Dono, hoje: Date): Promise<Set<string>> {
  const anoMes = hoje.toISOString().slice(0, 7);
  const linhas = await prisma.decisao.findMany({ where: { ...donoDe(dono), tipo: "raiox_confirmacao", chave: { endsWith: `|nao|${anoMes}` } }, select: { chave: true } });
  return new Set(linhas.map((l) => (l.chave ?? "").split("|")[0]));
}

/* ---------------------------------------------------------------- a tela */

/** Os lembretes que valem, por chave do Raio-X, para os itens dela que estão "para cancelar". */
export async function lembretesDoRaioX(ctx: QuemLe, itens: readonly Pick<RaioXItem, "chave" | "nome" | "descricao">[], respostas: RespostasDeAssinatura, agora: Date = new Date()): Promise<Record<string, LembreteNaTela>> {
  const lembretes = await carregarLembretes(ctx);
  if (lembretes.length === 0) return {};
  const hoje = hojeEmBrasilia(agora);
  const valem: { item: (typeof itens)[number]; l: LembreteDeAssinatura }[] = [];
  for (const item of itens) {
    const marcas = marcasDoRaioX(item);
    const estado = estadoDaAssinatura(marcas, respostas.eventos, marcas.some((m) => respostas.daCasa.has(m)));
    const l = lembreteQueVale(marcas, lembretes, estado);
    if (l) valem.push({ item, l });
  }
  if (valem.length === 0) return {};
  const comDia = valem.filter((v) => v.l.dia);
  const [h, aindaNao] = comDia.length > 0 ? await Promise.all([historicoDasCobrancas(ctx, comDia.map((v) => v.item.chave), hoje), respondidasAindaNao(ctx, hoje)]) : [null, new Set<string>()];
  const out: Record<string, LembreteNaTela> = {};
  for (const { item, l } of valem) {
    const aviso = h && l.dia ? avisoDeHoje(chaveDaIdentidade(l.marcas), l, hoje, { cobrancas: h.reais.get(item.chave) ?? [], dadosAte: h.dadosAte, respondeuAindaNao: aindaNao.has(item.chave) }) : null;
    out[item.chave] = { dia: l.dia, perguntar: aviso?.quando === "pergunta" };
  }
  return out;
}

/* ---------------------------------------------------------------- gravar */

async function gravar(ctx: AuthContext, acao: "ligar" | "desligar", dados: Omit<DadosDoLembrete, "em">, agora: Date) {
  await prisma.decisao.create({
    data: {
      ...donoDe(ctx),
      tipo: TIPO_DO_LEMBRETE,
      chave: chaveDaIdentidade(dados.marcas),
      descricao: acao,
      valor: dados.valor,
      dados: { ...dados, em: agora.toISOString() } satisfies DadosDoLembrete,
    },
  });
}

/** Os itens do Raio-X dela, refeitos no servidor (a tela só manda as chaves). */
async function itensPedidos(ctx: AuthContext, chaves: readonly string[], agora: Date) {
  const hoje = hojeEmBrasilia(agora);
  const itens = await itensDoRaioX(ctx, hoje.getUTCFullYear(), hoje.getUTCMonth() + 1);
  return itens.filter((i) => chaves.includes(i.chave));
}

/**
 * "Lembrar de cancelar no dia da cobrança": grava o pedido de cada assinatura que está "para
 * cancelar", com o dia e o valor tirados do histórico. Sem dia confiável, grava sem dia e a tela
 * pergunta. Devolve o que a tela mostra.
 */
export async function ligarLembretes(ctx: AuthContext, chaves: readonly string[], agora: Date = new Date()): Promise<Record<string, LembreteNaTela>> {
  const itens = await itensPedidos(ctx, chaves, agora);
  if (itens.length === 0) return {};
  const [respostas, h] = await Promise.all([carregarRespostasDeAssinatura(ctx), historicoDasCobrancas(ctx, itens.map((i) => i.chave), hojeEmBrasilia(agora))]);
  const out: Record<string, LembreteNaTela> = {};
  for (const item of itens) {
    const marcas = marcasDoRaioX(item);
    const estado = estadoDaAssinatura(marcas, respostas.eventos, marcas.some((m) => respostas.daCasa.has(m))).estado;
    if (estado !== "para_cancelar") continue;
    const d = diaDaCobranca(h.todas.get(item.chave) ?? []);
    await gravar(ctx, "ligar", { marcas, dia: d?.dia ?? null, valor: d?.valor ?? (item.mensal > 0 ? item.mensal : null), nome: item.nome, raiox: item.chave }, agora);
    out[item.chave] = { dia: d?.dia ?? null, perguntar: false };
  }
  return out;
}

/** "Que dia ela cobra?": ela diz o dia, o lembrete passa a valer nele. */
export async function definirDiaDoLembrete(ctx: AuthContext, chave: string, dia: number, agora: Date = new Date()): Promise<LembreteNaTela | null> {
  const [item] = await itensPedidos(ctx, [chave], agora);
  if (!item) return null;
  const respostas = await carregarRespostasDeAssinatura(ctx);
  const marcas = marcasDoRaioX(item);
  if (estadoDaAssinatura(marcas, respostas.eventos, marcas.some((m) => respostas.daCasa.has(m))).estado !== "para_cancelar") return null;
  await gravar(ctx, "ligar", { marcas, dia, valor: item.mensal > 0 ? item.mensal : null, nome: item.nome, raiox: item.chave }, agora);
  return { dia, perguntar: false };
}

/** Desfazer: tira o lembrete de cada assinatura pedida. */
export async function desligarLembretes(ctx: AuthContext, chaves: readonly string[], agora: Date = new Date()): Promise<void> {
  const itens = await itensPedidos(ctx, chaves, agora);
  const lembretes = await carregarLembretes(ctx);
  for (const item of itens) {
    const marcas = marcasDoRaioX(item);
    if (!lembretes.some((l) => l.marcas.some((m) => marcas.includes(m)))) continue;
    await gravar(ctx, "desligar", { marcas, dia: null, valor: null, nome: item.nome, raiox: item.chave }, agora);
  }
}

