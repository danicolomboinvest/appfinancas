"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyBudgetToWholeYear, applyBudgetToWholeYearForCustomCategory } from "@/lib/repositories/budget.repo";
import { createCustomCategory, deleteOwnCustomCategory } from "@/lib/repositories/custom-category.repo";
import { annualBudgetSchema, annualBudgetForCustomCategorySchema } from "@/lib/validations/budget.schema";
import { customCategorySchema } from "@/lib/validations/custom-category.schema";
import { PARENT_CATEGORIES } from "@/lib/categories";

export type AnnualBudgetState = { error?: string };

/**
 * Salva o planejamento de todas as categorias (padrão + personalizadas) de uma vez, um único
 * botão "Salvar tudo" em vez de um "Salvar" por cartão. Os campos chegam nomeados
 * `plannedAmount_<ParentCategory>` e `plannedAmount_custom_<id>` (ver OrcamentoForm.tsx).
 * Cada categoria já é salva de forma atômica internamente (applyBudgetToWholeYear faz um
 * $transaction pros 12 meses); aplicamos todas em paralelo já que são independentes entre si.
 */
export async function applyAllBudgetsAction(
  _prevState: AnnualBudgetState,
  formData: FormData,
): Promise<AnnualBudgetState> {
  const year = Number(formData.get("year"));
  const customCategoryIds = formData.getAll("customCategoryId").map(String);
  const ctx = await getRequiredSession();

  const parentWrites = PARENT_CATEGORIES.map((parentCategory) => {
    const raw = formData.get(`plannedAmount_${parentCategory}`);
    const parsed = annualBudgetSchema.safeParse({ year, parentCategory, plannedAmount: raw });
    return parsed.success ? applyBudgetToWholeYear(ctx, parsed.data) : Promise.reject(parsed.error);
  });

  const customWrites = customCategoryIds.map((customCategoryId) => {
    const raw = formData.get(`plannedAmount_custom_${customCategoryId}`);
    const parsed = annualBudgetForCustomCategorySchema.safeParse({ year, customCategoryId, plannedAmount: raw });
    return parsed.success
      ? applyBudgetToWholeYearForCustomCategory(ctx, parsed.data)
      : Promise.reject(parsed.error);
  });

  try {
    await Promise.all([...parentWrites, ...customWrites]);
  } catch {
    return { error: "Algum valor não pôde ser salvo, confira os campos e tente de novo." };
  }

  revalidatePath("/orcamento");
  revalidatePath("/orcamento/comparativo");
  revalidatePath(`/mensal/${year}`);
  return {};
}

export type CustomCategoryState = { error?: string };

export async function createCustomCategoryAction(
  _prevState: CustomCategoryState,
  formData: FormData,
): Promise<CustomCategoryState> {
  const parsed = customCategorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  try {
    await createCustomCategory(ctx, parsed.data);
  } catch {
    return { error: "Você já tem uma categoria com esse nome." };
  }
  revalidatePath("/orcamento");
  return {};
}

export async function deleteCustomCategoryAction(id: string): Promise<void> {
  const ctx = await getRequiredSession();
  await deleteOwnCustomCategory(ctx, id);
  revalidatePath("/orcamento");
  revalidatePath("/orcamento/comparativo");
}
