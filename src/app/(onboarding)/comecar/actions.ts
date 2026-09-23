"use server";

import type { ProfileKind } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateProfile, PROFILE_KINDS_ESCOLHIVEIS } from "@/lib/repositories/profile.repo";
import { markOnboarded } from "@/lib/repositories/user.repo";
import { profileTheme } from "@/lib/profiles/themes";

/** O ícone do primeiro perfil segue o tipo, igual ao que o cadastro de perfis faz. */
const ICONE: Record<ProfileKind, string> = { PESSOAL: "wallet", EMPRESA: "briefcase", CASAL: "heart", CASA: "home", PROJETO: "target", OUTRO: "circle" };

/** O nome do primeiro perfil quando a pessoa não digita um: segue o tipo escolhido. */
const NOME_PADRAO: Record<ProfileKind, string> = {
  PESSOAL: "Pessoal",
  EMPRESA: "Minha empresa",
  CASAL: "Casal",
  CASA: "Casa",
  PROJETO: "Projeto",
  OUTRO: "Meu dinheiro",
};

/**
 * A escolha da primeira entrada: tipo e tema do perfil que o app criou sozinho no cadastro.
 * Grava no perfil ativo, marca a pessoa como recebida e manda pro mês. Uma vez só: a partir
 * daqui o layout não redireciona mais pra cá.
 */
export async function comecarAction(input: { kind: string; theme: string; name?: string }): Promise<void> {
  const ctx = await getRequiredSession();
  const kind = (PROFILE_KINDS_ESCOLHIVEIS as string[]).includes(input.kind) ? (input.kind as ProfileKind) : "PESSOAL";
  const theme = profileTheme(input.theme).key;
  const name = input.name?.trim().slice(0, 40) || NOME_PADRAO[kind];
  await updateProfile(ctx, ctx.profileId, { name, kind, theme, icon: ICONE[kind] });
  await markOnboarded(ctx.userId);
  revalidatePath("/", "layout");
  redirect("/mensal");
}
