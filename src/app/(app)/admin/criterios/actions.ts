"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import { createCriterion, setCriterionActive } from "@/lib/repositories/criterion.repo";
import { criterionSchema } from "@/lib/validations/criterion.schema";

export type CriterionFormState = { error?: string };

export async function createCriterionAction(
  _prevState: CriterionFormState,
  formData: FormData,
): Promise<CriterionFormState> {
  const parsed = criterionSchema.safeParse({
    sheetType: formData.get("sheetType"),
    key: formData.get("key"),
    label: formData.get("label"),
    category: formData.get("category"),
    helpText: formData.get("helpText") || undefined,
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireAdmin();
  await createCriterion(parsed.data);
  revalidatePath("/admin/criterios");
  return {};
}

export async function toggleCriterionActiveAction(id: string, active: boolean) {
  await requireAdmin();
  await setCriterionActive(id, active);
  revalidatePath("/admin/criterios");
}
