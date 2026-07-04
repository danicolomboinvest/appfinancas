"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createGoal, deleteOwnGoal, updateOwnGoal } from "@/lib/repositories/goal.repo";
import { goalSchema } from "@/lib/validations/goal.schema";

export type GoalFormState = { error?: string };

function parseGoalForm(formData: FormData) {
  return goalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate"),
    currentAmount: formData.get("currentAmount"),
    annualRate: formData.get("annualRate"),
  });
}

export async function createGoalAction(_prevState: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await createGoal(ctx, parsed.data);
  revalidatePath("/planejamento/metas");
  return {};
}

export async function updateGoalAction(
  id: string,
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnGoal(ctx, id, parsed.data);
  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${id}`);
  return {};
}

export async function deleteGoalAction(id: string) {
  const ctx = await getRequiredSession();
  await deleteOwnGoal(ctx, id);
  revalidatePath("/planejamento/metas");
  redirect("/planejamento/metas");
}
