"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createCustomCategory, listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { DEFAULT_CUSTOM_CATEGORY_ICON_KEY } from "@/lib/categories";

export type CreateCategoryResult = { ok: true; id: string; name: string } | { ok: false; error: string };

/**
 * Cria uma categoria-mãe personalizada na hora (item 5) — usada no lançamento e na importação,
 * quando a categoria que a pessoa quer ainda não existe. Se já houver uma com o mesmo nome,
 * devolve a existente (o @@unique(userId, name) do banco impede duplicar).
 */
export async function createCategoryAction(name: string): Promise<CreateCategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Digite um nome para a categoria." };
  if (trimmed.length > 40) return { ok: false, error: "Nome muito longo (máx. 40 caracteres)." };

  const ctx = await getRequiredSession();
  const existing = (await listCustomCategories(ctx)).find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { ok: true, id: existing.id, name: existing.name };

  // Chave de ícone VÁLIDA ("tag", minúscula) — "TAG" não existe no mapa e a categoria ficaria
  // pra sempre com o ícone de fallback.
  const cat = await createCustomCategory(ctx, { name: trimmed, icon: DEFAULT_CUSTOM_CATEGORY_ICON_KEY });
  // A categoria nova já pode receber orçamento e aparecer nas telas relacionadas.
  revalidatePath("/orcamento");
  revalidatePath("/configuracoes/categorias");
  return { ok: true, id: cat.id, name: cat.name };
}
