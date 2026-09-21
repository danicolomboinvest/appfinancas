import type { Prisma, SimulationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Simulações salvas.
 *
 * A tabela existia desde o começo e NUNCA foi escrita — zero registros, nenhum código
 * gravando nela. Na prática toda simulação era digitada, lida uma vez e perdida: não dava pra
 * comparar dois cenários, voltar depois nem mostrar pra alguém. E o relatório de admin contava
 * "pessoas que salvaram simulação", que por isso marcava 0 para sempre.
 */

/** Teto por pessoa: o histórico é pra consultar, não pra virar depósito. */
const MAX_POR_PESSOA = 30;

export async function listSimulations(ctx: AuthContext) {
  return prisma.simulation.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    orderBy: { createdAt: "desc" },
    take: MAX_POR_PESSOA,
  });
}

export async function getSimulation(ctx: AuthContext, id: string) {
  return prisma.simulation.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}

export async function createSimulation(
  ctx: AuthContext,
  input: { type: SimulationType; name: string | null; inputJson: Prisma.InputJsonValue; outputJson: Prisma.InputJsonValue },
) {
  // Apaga a mais antiga quando o teto estoura, em vez de recusar o salvamento: recusar
  // obrigaria a pessoa a ir limpar a lista antes de guardar o que ela acabou de calcular.
  const total = await prisma.simulation.count({ where: { userId: ctx.userId, profileId: ctx.profileId } });
  if (total >= MAX_POR_PESSOA) {
    const excedente = await prisma.simulation.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId },
      orderBy: { createdAt: "asc" },
      take: total - MAX_POR_PESSOA + 1,
      select: { id: true },
    });
    await prisma.simulation.deleteMany({ where: { id: { in: excedente.map((s) => s.id) } } });
  }
  return prisma.simulation.create({ data: { userId: ctx.userId, profileId: ctx.profileId, ...input } });
}

/** `deleteMany` com o userId no where: garante que ninguém apague simulação de outra pessoa. */
export async function deleteSimulation(ctx: AuthContext, id: string) {
  return prisma.simulation.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}
