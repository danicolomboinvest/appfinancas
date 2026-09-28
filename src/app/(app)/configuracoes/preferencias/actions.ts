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
    // Ausente (tema que já decide o modo) vira undefined, não null: aí o schema aceita e o
    // modo guardado não é tocado.
    theme: formData.get("theme") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnPreferences(ctx, parsed.data);
  // A moeda aparece em TODA tela (e no cabeçalho, que vive no layout), então não adianta
  // revalidar só esta página: o "layout" faz a troca valer no app inteiro de uma vez.
  revalidatePath("/", "layout");
  return {};
}
