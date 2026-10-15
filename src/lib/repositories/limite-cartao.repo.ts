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

/** O perfil montou um limite? Para o layout, que ainda não tem a sessão com o perfil. */
export async function perfilTemLimiteDoCartao(userId: string, profileId: string): Promise<boolean> {
  const perfil = await prisma.financialProfile.findFirst({ where: { id: profileId, userId }, select: { limiteCartao: true } });
  return perfil?.limiteCartao != null;
}

/** Nulo tira o limite. */
export async function salvarLimiteDoCartao(ctx: AuthContext, valor: number | null): Promise<void> {
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { limiteCartao: valor } });
}

/**
 * Soma do que foi no cartão no mês. Estorno da fatura é gasto negativo e desconta sozinho.
 *
 * É "o gasto no cartão do MÊS" (15/10/2026), um dos dois números do cartão:
 * - gasto no cartão do mês (este): o que está no mês do app e é do cartão, pela marcação dela
 *   (noCartao) ou, sem marcação, por ter vindo de uma fatura. Mistura faturas (a compra de 28/09
 *   e a de 02/10 caem em faturas diferentes e no mesmo mês) e o que ela lançou à mão no cartão.
 *   Usam: o limite do cartão (card, aviso de 70/90/100%, o "Posso comprar?"), o "Seu cartão em
 *   outubro" da primeira vez no Foco (mensal/foco/novo/dados.ts) e o "Já marcado para o mês que
 *   vem" da missão 14 do Money Reset.
 * - total da fatura importada (lib/import/total-do-lote.ts, totalDoLote): o que UM arquivo trouxe,
 *   em qualquer mês, menos as parcelas projetadas. Usam: o histórico de importações e o "Sua última
 *   fatura" da missão 2 do Money Reset.
 * Os dois não precisam bater entre si (um é o mês, o outro é o arquivo); cada tela que fala do
 * mesmo assunto usa a mesma função.
 */
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
