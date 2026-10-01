import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { brazilTodayUtc } from "@/lib/date/brazil-day";

/**
 * A costura entre Fluxo, Carteira e Metas.
 *
 * Antes cada um vivia num canto: lançar "aportei R$ 2.500" no mês não mexia na carteira,
 * atualizar a carteira não aparecia no mês, e a meta somava o aporte E o ativo, contando o
 * mesmo dinheiro duas vezes. Aqui o aporte do fluxo é a ORIGEM do dinheiro, e dizer em quais
 * ativos ele entrou (ContributionAllocation) é o que fecha o ciclo: o ativo cresce, a meta
 * do ativo anda junto, e o mês continua com o mesmo valor de sempre.
 */

export type PendingContribution = {
  entryId: string;
  description: string | null;
  amount: number;
  /** Quanto deste aporte já foi distribuído em ativos. */
  allocated: number;
  /** O que falta dizer onde foi. */
  pending: number;
  goalId: string | null;
  goalName: string | null;
};

export type ContributionLinkState = {
  year: number;
  month: number;
  /** Total aportado no mês, segundo o fluxo. */
  total: number;
  /** Total já distribuído em ativos. */
  allocated: number;
  /** O que ainda não tem destino — é o que o card pergunta. */
  pending: number;
  contributions: PendingContribution[];
};

/**
 * Quanto a pessoa aportou no mês (lançamentos do fluxo) e quanto disso já virou ativo.
 * É o que a carteira usa pra dizer "esse mês você aportou X e ainda não disse onde foi".
 */
export async function getContributionLinkState(ctx: AuthContext, year: number, month: number): Promise<ContributionLinkState> {
  const entries = await prisma.monthlyEntry.findMany({
    where: {
      userId: ctx.userId, profileId: ctx.profileId,
      year,
      month,
      category: "INVESTMENT_CONTRIBUTION",
      // Só o que entrou: resgate é guardado NEGATIVO e tem a pergunta dele (getWithdrawalLinkState).
      amount: { gt: 0 },
      // Aporte com data que ainda não chegou (o do dia 25 de um "Repetir todo mês") não foi
      // aportado: no dia 1º a carteira já perguntava "você aportou R$ 1.000, em quais ativos?".
      // Sem data, vale o mês (é o que ela lançou à mão).
      OR: [{ entryDate: null }, { entryDate: { lte: brazilTodayUtc() } }],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      goalId: true,
      goal: { select: { name: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const contributions: PendingContribution[] = entries.map((e) => {
    const amount = Number(e.amount);
    const allocated = e.allocations.reduce((s, a) => s + Number(a.amount), 0);
    return {
      entryId: e.id,
      description: e.description,
      amount,
      allocated,
      // Centavo de arredondamento não vira "falta distribuir R$ 0,01".
      pending: Math.max(0, Math.round((amount - allocated) * 100) / 100),
      goalId: e.goalId,
      goalName: e.goal?.name ?? null,
    };
  });

  const total = contributions.reduce((s, c) => s + c.amount, 0);
  const allocated = contributions.reduce((s, c) => s + c.allocated, 0);
  // O que falta é a SOMA do que falta em cada aporte, não "total menos distribuído".
  // Parece a mesma conta e não é: se a pessoa editar um aporte pra menos DEPOIS de distribuir
  // (lançou 1.000, distribuiu 1.000, corrigiu pra 400), aquele lançamento fica com 600 de
  // sobra, e no total essa sobra comia o aporte seguinte — o app engolia em silêncio o dinheiro
  // novo, dizendo que não havia nada esperando destino.
  const pending = contributions.reduce((s, c) => s + c.pending, 0);
  return {
    year,
    month,
    total,
    allocated,
    pending: Math.round(pending * 100) / 100,
    contributions: contributions.filter((c) => c.pending > 0.009),
  };
}

/**
 * Ativos que receberam aporte dos meses informados (a carteira passa o atual e o anterior — os
 * dois cujo aporte ela ainda pergunta onde entrou). Apagar um desses ativos apaga junto as
 * distribuições (cascata), e o aporte volta a pedir destino: o "Remover" avisa antes.
 */
export async function assetIdsWithAllocationsIn(ctx: AuthContext, months: { year: number; month: number }[]): Promise<string[]> {
  if (months.length === 0) return [];
  const rows = await prisma.contributionAllocation.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, entry: { OR: months.map((m) => ({ year: m.year, month: m.month })) } },
    select: { assetId: true },
    distinct: ["assetId"],
  });
  return rows.map((r) => r.assetId);
}

export type AllocationInput = { assetId: string; amount: number };

export type AllocationResult =
  | {
      ok: true;
      applied: number;
      assets: number;
      goals: { name: string; amount: number }[];
      /** Ativos cotados cuja quantidade foi estimada pela cotação — o card pede pra ela conferir. */
      quantityEstimated: string[];
    }
  | { ok: false; error: string };

/**
 * Aplica a distribuição: cada pedaço entra no ativo escolhido (aumenta o quanto foi investido,
 * o valor atual e, em ativo com quantidade, a quantidade) e fica registrado contra o aporte de
 * origem. A conta de cada ativo mora em `assetAfterContribution`.
 */
export async function applyContributionAllocations(
  ctx: AuthContext,
  year: number,
  month: number,
  allocations: AllocationInput[],
): Promise<AllocationResult> {
  const validas = allocations.filter((a) => a.assetId && a.amount > 0);
  if (validas.length === 0) return { ok: false, error: "Diga pelo menos um ativo e um valor." };

  const state = await getContributionLinkState(ctx, year, month);
  if (state.pending <= 0) return { ok: false, error: "Não há aporte esperando destino neste mês." };

  const pedido = validas.reduce((s, a) => s + a.amount, 0);
  if (pedido > state.pending + 0.01) {
    return { ok: false, error: `Você está distribuindo mais do que aportou: sobram ${state.pending.toFixed(2)} pra distribuir.` };
  }

  // Só ativos do próprio usuário: id vindo do formulário nunca é confiável.
  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, id: { in: validas.map((a) => a.assetId) } },
    select: {
      id: true,
      name: true,
      ticker: true,
      investedValue: true,
      currentValue: true,
      quantity: true,
      currentUnitPrice: true,
      goalId: true,
      goal: { select: { name: true } },
    },
  });
  const byId = new Map(assets.map((a) => [a.id, a]));
  if (validas.some((a) => !byId.has(a.assetId))) return { ok: false, error: "Um dos ativos não existe mais. Recarregue a página." };

  const linhas = planAllocationLines(
    state.contributions.map((c) => ({ entryId: c.entryId, pending: c.pending })),
    validas,
  );

  // Um update por ativo com a soma do que entrou nele: dois pedaços pro mesmo ativo em updates
  // separados partiriam do mesmo valor lido, e o segundo apagaria o primeiro.
  const porAtivo = new Map<string, number>();
  for (const a of validas) porAtivo.set(a.assetId, Math.round(((porAtivo.get(a.assetId) ?? 0) + a.amount) * 100) / 100);
  const quantityEstimated: string[] = [];
  const updates = [...porAtivo.entries()].map(([assetId, amount]) => {
    const asset = byId.get(assetId)!;
    const depois = assetAfterContribution(
      {
        investedValue: asset.investedValue === null ? null : Number(asset.investedValue),
        currentValue: Number(asset.currentValue),
        quantity: asset.quantity === null ? null : Number(asset.quantity),
        currentUnitPrice: asset.currentUnitPrice === null ? null : Number(asset.currentUnitPrice),
      },
      amount,
    );
    if (depois.quantityEstimated) quantityEstimated.push(asset.ticker ?? asset.name);
    return prisma.asset.update({
      where: { id: assetId },
      data: {
        investedValue: depois.investedValue,
        currentValue: depois.currentValue,
        ...(depois.quantityEstimated ? { quantity: depois.quantity } : {}),
      },
    });
  });

  await prisma.$transaction([
    ...linhas.map((l) =>
      prisma.contributionAllocation.create({ data: { userId: ctx.userId, profileId: ctx.profileId, entryId: l.entryId, assetId: l.assetId, amount: l.amount } }),
    ),
    ...updates,
  ]);

  // Metas que andaram: é o que a tela devolve pra pessoa ver que tudo se moveu junto.
  const porMeta = new Map<string, number>();
  for (const a of validas) {
    const asset = byId.get(a.assetId)!;
    if (asset.goalId && asset.goal) porMeta.set(asset.goal.name, (porMeta.get(asset.goal.name) ?? 0) + a.amount);
  }

  return {
    ok: true,
    applied: Math.round(pedido * 100) / 100,
    assets: validas.length,
    goals: [...porMeta.entries()].map(([name, amount]) => ({ name, amount })),
    quantityEstimated,
  };
}

export type AssetPosition = {
  investedValue: number | null;
  currentValue: number;
  quantity: number | null;
  currentUnitPrice: number | null;
};

/**
 * Como um ativo fica depois de receber `amount` de um aporte.
 *
 * - Investido desconhecido (null) continua desconhecido. Tratar null como zero deixava um CDB
 *   de R$ 10.000 sem "valor investido" com investido R$ 500 depois de um aporte de R$ 500 — a
 *   carteira passava a mostrar +R$ 10.000 (+2000%) de um lucro que ninguém sabe se existe.
 * - Em ativo com quantidade, a quantidade cresce pelo preço de hoje (a cotação salva, ou o
 *   valor atual ÷ quantidade quando não há cotação). Sem isso, a atualização de cotação (o
 *   botão ou o cron diário) recalcula quantidade × preço com a quantidade velha e apaga o
 *   aporte do valor atual, enquanto o investido continua com ele: prejuízo falso, e a meta do
 *   ativo recuava junto. É uma estimativa — por isso o card pede pra ela conferir —, mas mantém
 *   o preço médio (investido ÷ quantidade) no lugar em vez de inflá-lo.
 */
export function assetAfterContribution(
  asset: AssetPosition,
  amount: number,
): { investedValue: number | null; currentValue: number; quantity: number | null; quantityEstimated: boolean } {
  const investedValue = asset.investedValue === null ? null : Math.round((asset.investedValue + amount) * 100) / 100;
  const currentValue = Math.round((asset.currentValue + amount) * 100) / 100;
  const qtd = asset.quantity ?? 0;
  const precoUnitario =
    asset.currentUnitPrice && asset.currentUnitPrice > 0 ? asset.currentUnitPrice : qtd > 0 && asset.currentValue > 0 ? asset.currentValue / qtd : 0;
  if (qtd > 0 && precoUnitario > 0) {
    // 6 casas: é a precisão da coluna (Decimal 18,6).
    const quantity = Math.round((qtd + amount / precoUnitario) * 1e6) / 1e6;
    return { investedValue, currentValue, quantity, quantityEstimated: true };
  }
  return { investedValue, currentValue, quantity: asset.quantity, quantityEstimated: false };
}

/**
 * Como um ativo fica depois de um resgate de `amount`: o espelho de assetAfterContribution.
 *
 * - O valor atual cai o que saiu (nunca abaixo de zero).
 * - O investido cai na MESMA proporção do valor atual, não o valor cheio: tirar R$ 1.100 de um
 *   CDB que tem R$ 1.100 sobre R$ 1.000 investidos zera os dois, e tirar metade deixa metade de
 *   cada. Descontar o valor cheio do investido inventava lucro (ou prejuízo) que não existe.
 * - Em ativo com quantidade, a quantidade cai pelo preço de hoje (estimativa, como no aporte).
 */
export function assetAfterWithdrawal(
  asset: AssetPosition,
  amount: number,
): { investedValue: number | null; currentValue: number; quantity: number | null; quantityEstimated: boolean } {
  const fracao = asset.currentValue > 0 ? Math.min(1, amount / asset.currentValue) : 1;
  const currentValue = Math.max(0, Math.round((asset.currentValue - amount) * 100) / 100);
  const investedValue = asset.investedValue === null ? null : Math.max(0, Math.round(asset.investedValue * (1 - fracao) * 100) / 100);
  const qtd = asset.quantity ?? 0;
  if (qtd > 0) {
    const quantity = Math.max(0, Math.round(qtd * (1 - fracao) * 1e6) / 1e6);
    return { investedValue, currentValue, quantity, quantityEstimated: true };
  }
  return { investedValue, currentValue, quantity: asset.quantity, quantityEstimated: false };
}

/**
 * O resgate do mês que ainda não disse de qual investimento saiu. Resgate é guardado NEGATIVO
 * (ver lib/entries/resgate.ts) e a ligação com o ativo é a mesma ContributionAllocation do aporte,
 * com valor negativo: assim a meta do ativo recua junto, pela mesma conta de sempre.
 */
export async function getWithdrawalLinkState(ctx: AuthContext, year: number, month: number): Promise<{ pending: number; goalName: string | null; slots: PendingSlot[] }> {
  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "INVESTMENT_CONTRIBUTION", amount: { lt: 0 } },
    select: { id: true, amount: true, goal: { select: { name: true } }, allocations: { select: { amount: true } } },
    orderBy: { createdAt: "asc" },
  });
  const slots = entries
    .map((e) => {
      const saiu = -Number(e.amount);
      const dito = e.allocations.reduce((s, a) => s - Number(a.amount), 0);
      return { entryId: e.id, pending: Math.max(0, Math.round((saiu - dito) * 100) / 100) };
    })
    .filter((s) => s.pending > 0.009);
  const pending = Math.round(slots.reduce((s, c) => s + c.pending, 0) * 100) / 100;
  return { pending, goalName: entries.find((e) => e.goal)?.goal?.name ?? null, slots };
}

/** Aplica o "saiu daqui": cada pedaço sai do ativo escolhido e fica registrado (negativo) contra o resgate. */
export async function applyWithdrawalAllocations(ctx: AuthContext, year: number, month: number, allocations: AllocationInput[]): Promise<AllocationResult> {
  const validas = allocations.filter((a) => a.assetId && a.amount > 0);
  if (validas.length === 0) return { ok: false, error: "Diga pelo menos um investimento e um valor." };
  const state = await getWithdrawalLinkState(ctx, year, month);
  if (state.pending <= 0) return { ok: false, error: "Não há resgate esperando neste mês." };
  const pedido = validas.reduce((s, a) => s + a.amount, 0);
  if (pedido > state.pending + 0.01) return { ok: false, error: `Você está dizendo mais do que resgatou: sobram ${state.pending.toFixed(2)}.` };

  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, id: { in: validas.map((a) => a.assetId) } },
    select: { id: true, name: true, ticker: true, investedValue: true, currentValue: true, quantity: true, currentUnitPrice: true, goal: { select: { name: true } } },
  });
  const byId = new Map(assets.map((a) => [a.id, a]));
  if (validas.some((a) => !byId.has(a.assetId))) return { ok: false, error: "Um dos investimentos não existe mais. Recarregue a página." };

  const porAtivo = new Map<string, number>();
  for (const a of validas) porAtivo.set(a.assetId, Math.round(((porAtivo.get(a.assetId) ?? 0) + a.amount) * 100) / 100);
  for (const [assetId, amount] of porAtivo) {
    const asset = byId.get(assetId)!;
    if (amount > Number(asset.currentValue) + 0.01) {
      return { ok: false, error: `${asset.ticker ?? asset.name} tem ${Number(asset.currentValue).toFixed(2)} na carteira: não dá pra tirar ${amount.toFixed(2)}. Atualize o valor dele primeiro.` };
    }
  }

  const linhas = planAllocationLines(state.slots, validas);
  const quantityEstimated: string[] = [];
  const updates = [...porAtivo.entries()].map(([assetId, amount]) => {
    const asset = byId.get(assetId)!;
    const depois = assetAfterWithdrawal(
      {
        investedValue: asset.investedValue === null ? null : Number(asset.investedValue),
        currentValue: Number(asset.currentValue),
        quantity: asset.quantity === null ? null : Number(asset.quantity),
        currentUnitPrice: asset.currentUnitPrice === null ? null : Number(asset.currentUnitPrice),
      },
      amount,
    );
    if (depois.quantityEstimated) quantityEstimated.push(asset.ticker ?? asset.name);
    return prisma.asset.update({
      where: { id: assetId },
      data: { investedValue: depois.investedValue, currentValue: depois.currentValue, ...(depois.quantityEstimated ? { quantity: depois.quantity } : {}) },
    });
  });

  await prisma.$transaction([
    ...linhas.map((l) =>
      prisma.contributionAllocation.create({ data: { userId: ctx.userId, profileId: ctx.profileId, entryId: l.entryId, assetId: l.assetId, amount: -l.amount } }),
    ),
    ...updates,
  ]);

  const porMeta = new Map<string, number>();
  for (const a of validas) {
    const meta = byId.get(a.assetId)!.goal?.name;
    if (meta) porMeta.set(meta, (porMeta.get(meta) ?? 0) + a.amount);
  }
  return {
    ok: true,
    applied: Math.round(pedido * 100) / 100,
    assets: porAtivo.size,
    goals: [...porMeta.entries()].map(([name, amount]) => ({ name, amount })),
    quantityEstimated,
  };
}

export type PendingSlot = { entryId: string; pending: number };
export type AllocationLine = { entryId: string; assetId: string; amount: number };

/**
 * Casa o que a pessoa pôs em cada ativo com os aportes que estão esperando destino.
 *
 * Por que não é só "um aporte, um ativo": num mês normal existem vários aportes (o do salário,
 * o do 13º, o que ela marcou pra meta) e a pessoa distribui pensando só nos ativos, sem saber
 * de qual lançamento saiu cada pedaço. Então os aportes são consumidos em ordem, do mais antigo
 * pro mais novo, e um mesmo ativo pode acabar ligado a dois aportes — e vice-versa.
 *
 * Fica separado e puro de propósito: é a parte que precisa aguentar mês inteiro de uso sendo
 * testada sem banco nenhum.
 */
export function planAllocationLines(pendings: PendingSlot[], allocations: AllocationInput[]): AllocationLine[] {
  const fila = pendings.map((c) => ({ entryId: c.entryId, restante: c.pending }));
  const linhas: AllocationLine[] = [];
  for (const a of allocations) {
    if (a.amount <= 0) continue;
    let falta = a.amount;
    for (const c of fila) {
      if (falta <= 0.0001) break;
      if (c.restante <= 0.0001) continue;
      const pedaco = Math.round(Math.min(falta, c.restante) * 100) / 100;
      if (pedaco <= 0) continue;
      // Mesmo aporte + mesmo ativo numa só linha: dois pedaços iguais seriam ruído no histórico.
      const existente = linhas.find((l) => l.entryId === c.entryId && l.assetId === a.assetId);
      if (existente) existente.amount = Math.round((existente.amount + pedaco) * 100) / 100;
      else linhas.push({ entryId: c.entryId, assetId: a.assetId, amount: pedaco });
      c.restante = Math.round((c.restante - pedaco) * 100) / 100;
      falta = Math.round((falta - pedaco) * 100) / 100;
    }
  }
  return linhas;
}

export type SnapshotAllocation = { assetId: string; amount: number };

/**
 * Quais distribuições voltar junto quando ela desfaz a exclusão de um aporte.
 *
 * Apagar o aporte apaga em cascata as linhas de ContributionAllocation, mas o dinheiro fica no
 * ativo (de propósito). Se o "Desfazer" recriasse só o lançamento, ele voltava como "ainda sem
 * destino": a carteira perguntava de novo onde o dinheiro entrou (e responder somava outra vez
 * no ativo) e a meta contava o aporte E o ativo — o dobro.
 *
 * A lista vem do cliente (o snapshot mora no toast), então só entra ativo que ainda é dela e
 * nunca mais do que o próprio aporte. O valor do ativo não é tocado: ele nunca saiu de lá.
 */
export function allocationsToRestore(
  snapshot: SnapshotAllocation[] | undefined,
  ownAssetIds: ReadonlySet<string>,
  entryAmount: number,
): SnapshotAllocation[] {
  const linhas: SnapshotAllocation[] = [];
  let restante = Math.round(entryAmount * 100) / 100;
  for (const a of snapshot ?? []) {
    if (restante <= 0) break;
    if (!ownAssetIds.has(a.assetId) || !(a.amount > 0)) continue;
    const amount = Math.round(Math.min(a.amount, restante) * 100) / 100;
    if (amount <= 0) continue;
    linhas.push({ assetId: a.assetId, amount });
    restante = Math.round((restante - amount) * 100) / 100;
  }
  return linhas;
}

/**
 * "Resgatei" direto no investimento (01/10/2026): a Dani abria o "Mexer" de um ativo e só havia
 * como trocar quanto vale e quantas cotas, sem o resgate ficar registrado em lugar nenhum.
 *
 * Num passo só: o resgate entra no mês como guardado NEGATIVO (ver lib/entries/resgate.ts), fica
 * ligado ao ativo pela mesma ContributionAllocation (negativa) que a pergunta da carteira usa, e
 * o ativo perde o valor pela regra de assetAfterWithdrawal — o investido cai na mesma proporção,
 * então a rentabilidade em % não muda e o lucro que saiu junto deixa de ser contado.
 */
export async function resgatarDeUmAtivo(
  ctx: AuthContext,
  input: { assetId: string; amount: number; date: Date },
): Promise<{ ok: true; meta: string | null } | { ok: false; error: string }> {
  if (!(input.amount > 0)) return { ok: false, error: "Diga quanto você resgatou." };
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, userId: ctx.userId, profileId: ctx.profileId },
    select: { id: true, name: true, ticker: true, investedValue: true, currentValue: true, quantity: true, currentUnitPrice: true, goalId: true, goal: { select: { name: true } } },
  });
  if (!asset) return { ok: false, error: "Esse investimento não existe mais. Recarregue a página." };
  const valor = Math.round(input.amount * 100) / 100;
  if (valor > Number(asset.currentValue) + 0.01) {
    return { ok: false, error: `Na carteira ele vale ${Number(asset.currentValue).toFixed(2)}. Se rendeu mais, atualize o valor de hoje antes de resgatar.` };
  }
  const depois = assetAfterWithdrawal(
    {
      investedValue: asset.investedValue === null ? null : Number(asset.investedValue),
      currentValue: Number(asset.currentValue),
      quantity: asset.quantity === null ? null : Number(asset.quantity),
      currentUnitPrice: asset.currentUnitPrice === null ? null : Number(asset.currentUnitPrice),
    },
    valor,
  );
  await prisma.$transaction(async (tx) => {
    const entrada = await tx.monthlyEntry.create({
      data: {
        userId: ctx.userId, profileId: ctx.profileId,
        year: input.date.getFullYear(),
        month: input.date.getMonth() + 1,
        category: "INVESTMENT_CONTRIBUTION",
        amount: -valor,
        description: `Resgate de ${asset.ticker ?? asset.name}`,
        entryDate: input.date,
        goalId: asset.goalId,
      },
      select: { id: true },
    });
    await tx.contributionAllocation.create({ data: { userId: ctx.userId, profileId: ctx.profileId, entryId: entrada.id, assetId: asset.id, amount: -valor } });
    await tx.asset.update({
      where: { id: asset.id },
      data: { investedValue: depois.investedValue, currentValue: depois.currentValue, ...(depois.quantityEstimated ? { quantity: depois.quantity } : {}) },
    });
  });
  return { ok: true, meta: asset.goal?.name ?? null };
}
