"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { upsertBudget } from "@/lib/repositories/budget.repo";
import { budgetSchema } from "@/lib/validations/budget.schema";

export type BudgetState = { error?: string };

export async function saveBudgetAction(_prevState: BudgetState, formData: FormData): Promise<BudgetState> {
  const parsed = budgetSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    parentCategory: formData.get("parentCategory"),
    plannedAmount: formData.get("plannedAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await upsertBudget(ctx, parsed.data);
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  return {};
}
