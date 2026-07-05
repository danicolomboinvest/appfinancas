"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateOwnProfile } from "@/lib/repositories/user.repo";
import { profileSchema } from "@/lib/validations/user-settings.schema";

export type ProfileState = { error?: string };

export async function updateProfileAction(_prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    avatarUrl: formData.get("avatarUrl") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnProfile(ctx, {
    name: parsed.data.name,
    email: parsed.data.email,
    avatarUrl: parsed.data.avatarUrl || undefined,
  });
  revalidatePath("/configuracoes/perfil");
  return {};
}
