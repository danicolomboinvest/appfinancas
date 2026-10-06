import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { situacaoDoLimite, type SituacaoDoLimite } from "@/lib/cartao/limite";
import type { Prisma } from "@prisma/client";

/**
 * Limite do cartão (06/10/2026): o valor mora no perfil (vale todo mês até ela mudar) e o gasto é
 * o do mês do app. As regras do que conta como cartão estão em lib/cartao/limite.ts (ehDoCartao);
 * aqui é a mesma regra escrita para o banco.
 */
function doCartaoNoMes(ctx: AuthContext, ano: number, mes: number): Prisma.MonthlyEntryWhereInput {
  return {
    userId: ctx.userId, profileId: ctx.profileId,
    year: ano,
    month: mes,
    category: "EXPENSE",
    OR: [{ noCartao: true }, { noCartao: null, importBatch: { docType: "fatura" } }],
  };
}

export async function lerLimiteDoCartao(ctx: AuthContext): Promise<number | null> {
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { limiteCartao: true } });
  return perfil?.limiteCartao != null ? Number(perfil.limiteCartao) : null;
}

/** Nulo tira o limite. */
export async function salvarLimiteDoCartao(ctx: AuthContext, valor: number | null): Promise<void> {
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { limiteCartao: valor } });
}

/** Soma do que foi no cartão no mês. Estorno da fatura é gasto negativo e desconta sozinho. */
export async function gastoNoCartao(ctx: AuthContext, ano: number, mes: number): Promise<number> {
  const r = await prisma.monthlyEntry.aggregate({ where: doCartaoNoMes(ctx, ano, mes), _sum: { amount: true } });
  return Number(r._sum.amount ?? 0);
}

/** Os gastos do cartão no mês, mais recentes primeiro, para a tela do limite. */
export async function listarGastosNoCartao(ctx: AuthContext, ano: number, mes: number, limite = 60) {
  return prisma.monthlyEntry.findMany({
    where: doCartaoNoMes(ctx, ano, mes),
    orderBy: [{ entryDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limite,
    select: { id: true, description: true, subcategory: true, parentCategory: true, amount: true, entryDate: true, importBatchId: true },
  });
}

/** Limite e gasto do mês juntos; nulo quando o perfil não tem limite. */
export async function situacaoDoCartao(ctx: AuthContext, ano: number, mes: number): Promise<SituacaoDoLimite | null> {
  const limite = await lerLimiteDoCartao(ctx);
  if (limite === null) return null;
  return situacaoDoLimite(await gastoNoCartao(ctx, ano, mes), limite);
}
