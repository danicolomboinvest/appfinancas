import { prisma } from "@/lib/db/prisma";
import { montarRegrasDaComunidade, type RegrasDaComunidade } from "@/lib/import/comunidade";

/** As regras mudam devagar (uma cliente nova por vez): recalcular a cada 6 horas basta. */
const VALIDADE_MS = 6 * 3_600_000;
let cache: { regras: RegrasDaComunidade; em: number } | null = null;

/**
 * Loja → categoria pelo que as clientes escolheram (ver lib/import/comunidade.ts). Só perfil
 * Pessoal: na Empresa as mesmas categorias querem dizer outra coisa. Só clientes: as contas de
 * teste e da equipe não votam. Se o banco falhar, segue sem: a importação nunca quebra por isto.
 */
export async function regrasDaComunidade(): Promise<RegrasDaComunidade> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.regras;
  try {
    const votos = await prisma.transactionCategoryRule.findMany({
      where: { user: { role: "CLIENT" }, OR: [{ profileId: null }, { profile: { kind: "PESSOAL" } }] },
      orderBy: { updatedAt: "asc" },
      select: { userId: true, pattern: true, parentCategory: true },
    });
    cache = { regras: montarRegrasDaComunidade(votos), em: Date.now() };
    return cache.regras;
  } catch (err) {
    console.error("regrasDaComunidade falhou (seguindo sem)", err);
    return cache?.regras ?? new Map();
  }
}
