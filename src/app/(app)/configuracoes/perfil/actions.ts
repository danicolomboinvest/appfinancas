"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateOwnProfile, getOwnUser } from "@/lib/repositories/user.repo";
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

  // O e-mail É a chave do acesso (allowlist da compra): trocar livremente permitiria ocupar o
  // e-mail liberado de OUTRO comprador que ainda não se cadastrou, ou se trancar pra fora
  // trocando pra um e-mail sem liberação. Troca de e-mail só via suporte (admin).
  const current = await getOwnUser(ctx);
  if (parsed.data.email.trim().toLowerCase() !== current.email.toLowerCase()) {
    return {
      error: "O e-mail é o seu acesso (vinculado à compra) e não pode ser trocado por aqui. Fale com o suporte.",
    };
  }

  await updateOwnProfile(ctx, {
    name: parsed.data.name,
    avatarUrl: parsed.data.avatarUrl || undefined,
  });
  revalidatePath("/configuracoes/perfil");
  return {};
}
