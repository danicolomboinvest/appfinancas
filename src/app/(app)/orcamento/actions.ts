"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyBudgetToWholeYear, applyBudgetToWholeYearForCustomCategory } from "@/lib/repositories/budget.repo";
import { createCustomCategory, deleteOwnCustomCategory } from "@/lib/repositories/custom-category.repo";
import { annualBudgetSchema, annualBudgetForCustomCategorySchema } from "@/lib/validations/budget.schema";
import { customCategorySchema } from "@/lib/validations/custom-category.schema";

export type AnnualBudgetState = { error?: string };

export async function applyBudgetToWholeYearAction(
  _prevState: AnnualBudgetState,
  formData: FormData,
): Promise<AnnualBudgetState> {
  const parsed = annualBudgetSchema.safeParse({
    year: formData.get("year"),
    parentCategory: formData.get("parentCategory"),
    plannedAmount: formData.get("plannedAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await applyBudgetToWholeYear(ctx, parsed.data);
  revalidatePath("/orcamento");
  revalidatePath(`/mensal/${parsed.data.year}`);
  return {};
}

export async function applyBudgetToWholeYearForCustomCategoryAction(
  _prevState: AnnualBudgetState,
  formData: FormData,
): Promise<AnnualBudgetState> {
  const parsed = annualBudgetForCustomCategorySchema.safeParse({
    year: formData.get("year"),
    customCategoryId: formData.get("customCategoryId"),
    plannedAmount: formData.get("plannedAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await applyBudgetToWholeYearForCustomCategory(ctx, parsed.data);
  revalidatePath("/orcamento");
  revalidatePath("/orcamento/comparativo");
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
