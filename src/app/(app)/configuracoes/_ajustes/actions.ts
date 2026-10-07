"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { preferencesSchema } from "@/lib/validations/user-settings.schema";

/**
 * Troca a moeda direto da tela de Configurações, num toque (07/10/2026): antes ela morava em
 * "Preferências", com um Salvar, e a Dani nunca achava onde trocar.
 */
export async function trocarMoedaAction(currency: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = preferencesSchema.pick({ currency: true }).safeParse({ currency });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Moeda inválida." };
  const ctx = await getRequiredSession();
  await prisma.user.update({ where: { id: ctx.userId }, data: { currency: parsed.data.currency } });
  // A moeda aparece em toda tela (e no cabeçalho, que vive no layout).
  revalidatePath("/", "layout");
  return { ok: true };
}
