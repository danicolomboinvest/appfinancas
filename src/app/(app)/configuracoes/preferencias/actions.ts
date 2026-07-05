"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateOwnPreferences } from "@/lib/repositories/user.repo";
import { preferencesSchema } from "@/lib/validations/user-settings.schema";

export type PreferencesState = { error?: string };

export async function updatePreferencesAction(
  _prevState: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const parsed = preferencesSchema.safeParse({
    currency: formData.get("currency"),
    theme: formData.get("theme"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnPreferences(ctx, parsed.data);
  revalidatePath("/configuracoes/preferencias");
  return {};
}
