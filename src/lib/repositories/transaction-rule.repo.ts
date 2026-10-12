import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { padraoAprendivel, padroesDaCorrecao, type LinhaCorrigida } from "@/lib/import/classify";
import { chaveCobre, chaveDoComerciante, chaveUtil } from "@/lib/import/comerciante";

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
  input: { pattern: string; parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string | null },
) {
  if (!input.pattern.trim() || !(chaveUtil(input.pattern) || padraoAprendivel(input.pattern))) return null;
  // A personalizada manda; a categoria-mãe fica de reserva (OUTROS) e sem subcategoria.
  const customCategoryId = input.customCategoryId ?? null;
  const existing = await prisma.transactionCategoryRule.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, pattern: input.pattern },
  });
  if (existing) {
    return prisma.transactionCategoryRule.update({
      where: { id: existing.id },
      data: { parentCategory: input.parentCategory, subcategory: customCategoryId ? null : (input.subcategory ?? null), customCategoryId },
    });
  }
  return prisma.transactionCategoryRule.create({
    data: {
      userId: ctx.userId, profileId: ctx.profileId,
      pattern: input.pattern,
      parentCategory: input.parentCategory,
      subcategory: customCategoryId ? null : (input.subcategory ?? null),
      customCategoryId,
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
    select: { id: true, pattern: true, parentCategory: true, subcategory: true, customCategory: { select: { name: true } } },
    orderBy: { pattern: "asc" },
  });
}

/** Apaga uma regra aprendida. Só a do próprio usuário no perfil aberto. */
export async function deleteOwnTransactionRule(ctx: AuthContext, id: string) {
  return prisma.transactionCategoryRule.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * "Os outros meses" (12/10/2026): ela respondeu "ManyChat é Dani Invest" numa importação e os
 * ManyChat dos meses que já estavam no app continuavam sem categoria. Põe a mesma escolha nos
 * gastos DESTE perfil que ainda estão SEM categoria nenhuma e são do mesmo comerciante. Nunca
 * mexe no que já tem categoria (escolha dela ou palpite já conferido). Devolve quantos mudaram.
 */
export async function aplicarNosOutrosMeses(
  ctx: AuthContext,
  regras: { pattern: string; parentCategory: ParentCategory; subcategory?: string | null; customCategoryId?: string | null }[],
): Promise<number> {
  const uteis = regras.filter((r) => chaveUtil(r.pattern));
  if (uteis.length === 0) return 0;
  const semCategoria = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", parentCategory: null, customCategoryId: null, description: { not: null } },
    select: { id: true, description: true },
    take: 5000,
  });
  let mudou = 0;
  for (const regra of uteis) {
    const ids = semCategoria.filter((e) => chaveCobre(regra.pattern, chaveDoComerciante(e.description))).map((e) => e.id);
    if (ids.length === 0) continue;
    const r = await prisma.monthlyEntry.updateMany({
      where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId, parentCategory: null, customCategoryId: null },
      data: regra.customCategoryId
        ? { customCategoryId: regra.customCategoryId }
        : { parentCategory: regra.parentCategory, subcategory: regra.subcategory ?? null },
    });
    mudou += r.count;
  }
  return mudou;
}
