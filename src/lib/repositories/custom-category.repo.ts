import { Prisma, type ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { categoriaParecida, ICONE_CUIDADO_PESSOAL, NOME_CUIDADO_PESSOAL } from "@/lib/import/cuidado-pessoal";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { lerPreferenciasDeCategoria } from "@/lib/categories";
import { CATEGORIAS_QUE_JA_NASCEM, sugeridasQueFaltam } from "@/lib/categorias/que-ja-nascem";

/** Categorias personalizadas do usuário, mais recente primeiro. */
export async function listCustomCategories(ctx: AuthContext) {
  return prisma.customCategory.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { createdAt: "asc" } });
}

export async function createCustomCategory(ctx: AuthContext, input: { name: string; icon: string }) {
  return prisma.customCategory.create({ data: { ...input, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * Apaga uma categoria personalizada do próprio usuário. Os `Budget` planejados nela são
 * apagados junto (não faz sentido manter orçamento pra uma categoria que não existe mais);
 * os `MonthlyEntry` já lançados nela ficam, só perdem a categoria (`customCategoryId` vira
 * null via `ON DELETE SET NULL` no banco), preservando o histórico de gastos do usuário.
 */
export async function deleteOwnCustomCategory(ctx: AuthContext, id: string) {
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, customCategoryId: id } }),
    prisma.customCategory.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } }),
  ]);
}

/** Troca nome e ícone de uma categoria dela (01/10/2026): antes só dava para apagar e criar de novo. */
export async function updateOwnCustomCategory(ctx: AuthContext, id: string, input: { name: string; icon: string }) {
  return prisma.customCategory.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: input });
}

/** Quantos lançamentos deste perfil estão nesta categoria dela (o "para onde vão?" do apagar). */
export async function contarLancamentosDaCategoria(ctx: AuthContext, id: string): Promise<number> {
  return prisma.monthlyEntry.count({ where: { userId: ctx.userId, profileId: ctx.profileId, customCategoryId: id } });
}

/**
 * Apaga a categoria dela levando os lançamentos para outra (12/10/2026): uma categoria-mãe
 * (ParentCategory) ou outra categoria dela. Sem destino, ficam sem categoria, como antes.
 */
export async function apagarCategoriaMovendo(ctx: AuthContext, id: string, destino: { parentCategory: ParentCategory } | { customCategoryId: string } | null) {
  const dono = { userId: ctx.userId, profileId: ctx.profileId };
  if (destino && "customCategoryId" in destino) {
    const existe = await prisma.customCategory.findFirst({ where: { ...dono, id: destino.customCategoryId }, select: { id: true } });
    if (!existe || destino.customCategoryId === id) throw new Error("Categoria de destino inválida.");
  }
  const dados = !destino ? { customCategoryId: null } : "parentCategory" in destino ? { customCategoryId: null, parentCategory: destino.parentCategory } : { customCategoryId: destino.customCategoryId, parentCategory: null };
  await prisma.$transaction([
    prisma.monthlyEntry.updateMany({ where: { ...dono, customCategoryId: id }, data: dados }),
    prisma.budget.deleteMany({ where: { ...dono, customCategoryId: id } }),
    prisma.customCategory.deleteMany({ where: { ...dono, id } }),
  ]);
}

/**
 * A categoria "Cuidado pessoal" deste perfil para a importação (lib/import/cuidado-pessoal.ts): a
 * dela com nome parecido ou uma criada agora. Perfil Empresa: null (não cria categoria pessoal).
 * Duas importações ao mesmo tempo: a segunda bate no índice único (userId, profileId, name) e
 * usa a que a primeira criou.
 */
export async function garantirCuidadoPessoal(
  ctx: Pick<AuthContext, "userId" | "profileId" | "profileKind">,
  existentes?: { id: string; name: string; icon: string }[],
): Promise<{ id: string; name: string; icon: string } | null> {
  if (ehEmpresa(ctx.profileKind)) return null;
  const dono = { userId: ctx.userId, profileId: ctx.profileId };
  const lista = existentes ?? (await prisma.customCategory.findMany({ where: dono, orderBy: { createdAt: "asc" }, select: { id: true, name: true, icon: true } }));
  const parecida = categoriaParecida(lista);
  if (parecida) return { id: parecida.id, name: parecida.name, icon: parecida.icon };
  try {
    const criada = await prisma.customCategory.create({ data: { ...dono, name: NOME_CUIDADO_PESSOAL, icon: ICONE_CUIDADO_PESSOAL } });
    return { id: criada.id, name: criada.name, icon: criada.icon };
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
    const ja = await prisma.customCategory.findFirst({ where: { ...dono, name: NOME_CUIDADO_PESSOAL }, select: { id: true, name: true, icon: true } });
    if (!ja) throw e;
    return ja;
  }
}

/** O que o semeador precisa do Prisma (o cliente de sempre ou a transação em que o perfil nasce). */
export type DbDasQueJaNascem = Pick<Prisma.TransactionClient, "customCategory" | "financialProfile">;

/**
 * As categorias que já nascem com o perfil Pessoal (30/10/2026, que-ja-nascem.ts): Beleza, Roupas,
 * Presentes, Pet, Assinaturas, Academia e Doação viram CustomCategory da pessoa, com a cor nas
 * preferências do perfil (como a folha Nova categoria grava). Idempotente: compara o nome sem
 * acento e sem caixa (e os parecidos: "Vestuário" já cobre Roupas) e só cria o que falta; duas
 * chamadas ao mesmo tempo esbarram no índice único (userId, profileId, name) e o `skipDuplicates`
 * deixa passar. Devolve quantas nasceram agora. Perfil Empresa: nenhuma (quem chama decide).
 */
export async function semearCategoriasQueJaNascem(dono: { userId: string; profileId: string }, db: DbDasQueJaNascem = prisma): Promise<number> {
  const existentes = await db.customCategory.findMany({ where: dono, select: { name: true } });
  const faltam = sugeridasQueFaltam(existentes);
  if (faltam.length === 0) return 0;
  const criadas = await db.customCategory.createMany({ data: faltam.map((c) => ({ ...dono, name: c.nome, icon: c.icone })), skipDuplicates: true });
  if (criadas.count === 0) return 0;
  // A cor mora em FinancialProfile.categorias.proprias[id].cor (ver PreferenciaDePropria).
  const novas = await db.customCategory.findMany({ where: { ...dono, name: { in: faltam.map((c) => c.nome) } }, select: { id: true, name: true } });
  if (novas.length === 0) return criadas.count;
  const perfil = await db.financialProfile.findFirst({ where: { id: dono.profileId, userId: dono.userId }, select: { categorias: true } });
  if (perfil) {
    const prefs = lerPreferenciasDeCategoria(perfil.categorias);
    const proprias = { ...(prefs.proprias ?? {}) };
    for (const n of novas) {
      const cor = CATEGORIAS_QUE_JA_NASCEM.find((c) => c.nome === n.name)?.cor;
      if (cor && !proprias[n.id]?.cor) proprias[n.id] = { ...(proprias[n.id] ?? {}), cor };
    }
    prefs.proprias = proprias;
    await db.financialProfile.updateMany({ where: { id: dono.profileId, userId: dono.userId }, data: { categorias: JSON.parse(JSON.stringify(prefs)) } });
  }
  return criadas.count;
}
