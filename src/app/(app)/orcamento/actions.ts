"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyBudgetToWholeYear } from "@/lib/repositories/budget.repo";
import { annualBudgetSchema } from "@/lib/validations/budget.schema";

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
