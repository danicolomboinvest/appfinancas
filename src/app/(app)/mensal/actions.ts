"use server";

import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listRecentSubcategories, listSubcategoriasDasCriadas } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { listTransactionRules } from "@/lib/repositories/transaction-rule.repo";
import { parseVoiceEntry, type ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";
import { getUserCurrency } from "@/lib/money-server";
import { casaAtiva } from "@/lib/casa/regras";

export async function getRecentSubcategoriesAction(): Promise<Record<ParentCategory, string[]>> {
  const ctx = await getRequiredSession();
  return listRecentSubcategories(ctx);
}

/** Os tipos que ela já usou em cada categoria criada por ela (os chips do Digitar, 18/10/2026). */
export async function subcategoriasDasCriadasAction(): Promise<Record<string, string[]>> {
  const ctx = await getRequiredSession();
  return listSubcategoriasDasCriadas(ctx);
}

export async function getCustomCategoriesAction(): Promise<{ id: string; name: string; icon: string }[]> {
  const ctx = await getRequiredSession();
  const categories = await listCustomCategories(ctx);
  return categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
}

export async function getGoalsAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const goals = await listGoals(ctx);
  return goals.map((g) => ({ id: g.id, name: g.name }));
}

/** Os OUTROS perfis do usuário (não o ativo) — pra importar a fatura e mandar uma compra que é
 * da Empresa, mas caiu no cartão Pessoal, pro perfil certo, sem sair do fluxo de revisão. */
export async function getOtherProfilesAction(): Promise<{ id: string; name: string; kind: string }[]> {
  const ctx = await getRequiredSession();
  const profiles = await listProfiles(ctx.userId);
  // O tipo diz como cada categoria se chama lá (na Empresa, ALIMENTACAO é "Mercadorias e insumos").
  return profiles.filter((p) => p.id !== ctx.profileId).map((p) => ({ id: p.id, name: p.name, kind: p.kind }));
}

/**
 * O que ela falou, entendido com as regras DELA (14/10/2026): o mesmo motor da importação, com as
 * correções que ela já ensinou e as categorias que ela criou. As regras não saem do servidor; o
 * aparelho só recebe a resposta.
 */
export async function entenderFalaAction(transcricao: string): Promise<ParsedVoiceEntry> {
  const texto = String(transcricao ?? "").slice(0, 300);
  const ctx = await getRequiredSession();
  const [regras, personalizadas] = await Promise.all([listTransactionRules(ctx), listCustomCategories(ctx)]);
  return parseVoiceEntry(texto, {
    moedaDoApp: await getUserCurrency(),
    profileKind: ctx.profileKind,
    regras: regras.map((r) => ({
      pattern: r.pattern,
      parentCategory: r.parentCategory,
      subcategory: r.subcategory ?? undefined,
      customCategoryId: r.customCategoryId ?? undefined,
    })),
    personalizadas: personalizadas.map((c) => ({ id: c.id, name: c.name })),
  }, { nomeDoPar: casaAtiva(ctx)?.outro.nome ?? null });
}
