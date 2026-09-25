"use server";

import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";

export async function getRecentSubcategoriesAction(): Promise<Record<ParentCategory, string[]>> {
  const ctx = await getRequiredSession();
  return listRecentSubcategories(ctx);
}

export async function getCustomCategoriesAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const categories = await listCustomCategories(ctx);
  return categories.map((c) => ({ id: c.id, name: c.name }));
}

export async function getGoalsAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const goals = await listGoals(ctx);
  return goals.map((g) => ({ id: g.id, name: g.name }));
}

/** Os OUTROS perfis do usuário (não o ativo) — pra importar a fatura e mandar uma compra que é
 * da Empresa, mas caiu no cartão Pessoal, pro perfil certo, sem sair do fluxo de revisão. */
export async function getOtherProfilesAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const profiles = await listProfiles(ctx.userId);
  return profiles.filter((p) => p.id !== ctx.profileId).map((p) => ({ id: p.id, name: p.name }));
}
