import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { padraoAprendivel, padroesDaCorrecao, type LinhaCorrigida } from "@/lib/import/classify";

/**
 * Mais recente primeiro: entre duas regras do mesmo tamanho que casam, o classificador fica com
 * a primeira da lista, e a que ela ensinou por último é a que ela quer (ver matchLearned).
 */
export async function listTransactionRules(ctx: AuthContext) {
  return prisma.transactionCategoryRule.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Grava (ou atualiza) uma regra aprendida merchant → categoria para o usuário. Padrão sem nome
 * de quem recebeu ("no" de "Compra no débito", "enviado" de "PIX ENVIADO") não vira regra:
 * pegaria toda compra e todo Pix dali pra frente, na importação e no Open Finance.
 */
export async function upsertTransactionRule(
  ctx: AuthContext,
  input: { pattern: string; parentCategory: ParentCategory; subcategory?: string },
) {
  if (!input.pattern.trim() || !padraoAprendivel(input.pattern)) return null;
  const existing = await prisma.transactionCategoryRule.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, pattern: input.pattern },
  });
  if (existing) {
    return prisma.transactionCategoryRule.update({
      where: { id: existing.id },
      data: { parentCategory: input.parentCategory, subcategory: input.subcategory ?? null },
    });
  }
  return prisma.transactionCategoryRule.create({
    data: {
      userId: ctx.userId, profileId: ctx.profileId,
      pattern: input.pattern,
      parentCategory: input.parentCategory,
      subcategory: input.subcategory ?? null,
    },
  });
}

/**
 * Os lançamentos como estão ANTES de uma troca de categoria, no formato que padroesDaCorrecao
 * entende. Lido antes do update: depois dele não dá mais pra saber se a categoria mudou.
 */
export async function linhasAntesDaCorrecao(ctx: AuthContext, ids: string[]): Promise<LinhaCorrigida[]> {
  if (ids.length === 0) return [];
  const linhas = await prisma.monthlyEntry.findMany({
    where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId },
    select: { description: true, category: true, parentCategory: true, customCategoryId: true, importBatchId: true, externalId: true },
  });
  return linhas.map((l) => ({
    description: l.description,
    category: l.category,
    parentCategory: l.parentCategory,
    customCategoryId: l.customCategoryId,
    importada: l.importBatchId !== null || l.externalId !== null,
  }));
}

/**
 * Ensina o app com uma correção feita depois da importação (tela do mês, edição em lote). Falha
 * aqui não desfaz a correção dela: a categoria já foi salva, só a próxima importação não aprende.
 */
export async function aprenderComCorrecao(
  ctx: AuthContext,
  antes: LinhaCorrigida[],
  nova: { parentCategory: ParentCategory; subcategory?: string },
) {
  for (const pattern of padroesDaCorrecao(antes, nova.parentCategory)) {
    try {
      await upsertTransactionRule(ctx, { pattern, parentCategory: nova.parentCategory, subcategory: nova.subcategory });
    } catch (err) {
      console.error("aprenderComCorrecao falhou:", err);
    }
  }
}

/** As regras que o app aprendeu com ela neste perfil, pra ela ver e apagar a que ficou errada. */
export async function listTransactionRulesForSettings(ctx: AuthContext) {
  return prisma.transactionCategoryRule.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    select: { id: true, pattern: true, parentCategory: true, subcategory: true },
    orderBy: { pattern: "asc" },
  });
}

/** Apaga uma regra aprendida. Só a do próprio usuário no perfil aberto. */
export async function deleteOwnTransactionRule(ctx: AuthContext, id: string) {
  return prisma.transactionCategoryRule.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}
