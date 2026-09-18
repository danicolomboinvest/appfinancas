import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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
    where: { userId: ctx.userId, year, month, category: "INVESTMENT_CONTRIBUTION" },
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

export type AllocationInput = { assetId: string; amount: number };

export type AllocationResult =
  | { ok: true; applied: number; assets: number; goals: { name: string; amount: number }[] }
  | { ok: false; error: string };

/**
 * Aplica a distribuição: cada pedaço entra no ativo escolhido (aumenta o quanto foi investido
 * e o valor atual) e fica registrado contra o aporte de origem.
 *
 * Quantidade não é mexida de propósito: o app não tem como saber a que preço a pessoa comprou,
 * e chutar cota estragaria o preço médio. Ela ajusta na próxima atualização de cotação ou ao
 * subir a posição da corretora.
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
    where: { userId: ctx.userId, id: { in: validas.map((a) => a.assetId) } },
    select: { id: true, name: true, investedValue: true, currentValue: true, goalId: true, goal: { select: { name: true } } },
  });
  const byId = new Map(assets.map((a) => [a.id, a]));
  if (validas.some((a) => !byId.has(a.assetId))) return { ok: false, error: "Um dos ativos não existe mais. Recarregue a página." };

  const linhas = planAllocationLines(
    state.contributions.map((c) => ({ entryId: c.entryId, pending: c.pending })),
    validas,
  );

  await prisma.$transaction([
    ...linhas.map((l) =>
      prisma.contributionAllocation.create({ data: { userId: ctx.userId, entryId: l.entryId, assetId: l.assetId, amount: l.amount } }),
    ),
    ...validas.map((a) => {
      const asset = byId.get(a.assetId)!;
      return prisma.asset.update({
        where: { id: a.assetId },
        data: {
          investedValue: Number(asset.investedValue) + a.amount,
          currentValue: Number(asset.currentValue) + a.amount,
        },
      });
    }),
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
