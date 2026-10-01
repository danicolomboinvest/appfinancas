"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { deleteOwnTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { prisma } from "@/lib/db/prisma";
import { CUSTOM_CATEGORY_ICON_KEYS, PARENT_CATEGORIES, isParentCategoryKey, lerPreferenciasDeCategoria } from "@/lib/categories";
import { deleteOwnCustomCategory, updateOwnCustomCategory } from "@/lib/repositories/custom-category.repo";

/**
 * Apaga uma regra aprendida. Antes não havia tela pra isso: uma regra ruim (uma loja ensinada
 * na categoria errada) ficava valendo pra sempre em toda importação e no Open Finance.
 */
export async function deleteTransactionRuleAction(ruleId: string) {
  const id = z.string().min(1).max(60).parse(ruleId);
  const ctx = await getRequiredSession();
  await deleteOwnTransactionRule(ctx, id);
  revalidatePath("/configuracoes/categorias");
}

const ICONE = z.string().refine((k) => CUSTOM_CATEGORY_ICON_KEYS.includes(k), "Ícone inválido.");

function revalidarCategorias() {
  // O nome e o ícone aparecem no app inteiro (mês, gastos, orçamento, Foco), por isso o layout.
  revalidatePath("/", "layout");
}

/**
 * Nome, ícone e "esconder" de uma categoria PADRÃO deste perfil (01/10/2026). A cliente queria
 * tirar "Impostos", que não usa, e chamar as outras do jeito dela. A chave gravada nos lançamentos
 * não muda: é só como o app mostra. Nome vazio ou ícone vazio = volta ao de fábrica.
 */
export async function salvarCategoriaPadraoAction(input: { key: string; nome: string; icone: string | null; oculta: boolean }): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  if (!isParentCategoryKey(input.key)) return { error: "Categoria inválida." };
  const nome = input.nome.trim().slice(0, 40);
  if (input.icone !== null && !ICONE.safeParse(input.icone).success) return { error: "Ícone inválido." };
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { categorias: true } });
  if (!perfil) return { error: "Perfil não encontrado." };
  const prefs = lerPreferenciasDeCategoria(perfil.categorias);
  const pref = { ...(nome ? { nome } : {}), ...(input.icone ? { icone: input.icone } : {}), ...(input.oculta ? { oculta: true } : {}) };
  if (Object.keys(pref).length === 0) delete prefs[input.key];
  else prefs[input.key] = pref;
  // Escondidas demais deixariam o gasto sem onde cair: pelo menos 3 continuam à vista.
  if (PARENT_CATEGORIES.filter((k) => !prefs[k]?.oculta).length < 3) return { error: "Deixe pelo menos 3 categorias à vista." };
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { categorias: prefs } });
  revalidarCategorias();
  return {};
}

/** Nome e ícone de uma categoria criada por ela, sem precisar apagar e criar de novo. */
export async function editarCategoriaPropriaAction(input: { id: string; nome: string; icone: string }): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  const id = z.string().min(1).max(60).safeParse(input.id);
  const nome = input.nome.trim().slice(0, 40);
  if (!id.success || !nome) return { error: "Dê um nome para a categoria." };
  if (!ICONE.safeParse(input.icone).success) return { error: "Ícone inválido." };
  const igual = await prisma.customCategory.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, name: nome, NOT: { id: id.data } }, select: { id: true } });
  if (igual) return { error: "Você já tem uma categoria com esse nome." };
  await updateOwnCustomCategory(ctx, id.data, { name: nome, icon: input.icone });
  revalidarCategorias();
  return {};
}

export async function apagarCategoriaPropriaAction(categoriaId: string): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  const id = z.string().min(1).max(60).parse(categoriaId);
  await deleteOwnCustomCategory(ctx, id);
  revalidarCategorias();
  return {};
}
