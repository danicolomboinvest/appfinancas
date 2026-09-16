"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const themeSchema = z.enum(["dark", "light"]);

/**
 * Troca só o tema, sem passar pela tela de Preferências.
 *
 * Existe porque o caminho até lá é longo no celular: "Mais" → Configurações → Preferências →
 * um seletor chamado "Tema" dentro de um formulário com botão Salvar. Deixar a tela clara é
 * uma preferência de conforto, do tipo que a pessoa quer trocar na hora — não algo que se
 * procura em três telas.
 */
export async function setThemeAction(theme: string): Promise<{ ok: boolean }> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { ok: false };

  const ctx = await getRequiredSession();
  await prisma.user.update({ where: { id: ctx.userId }, data: { theme: parsed.data } });
  // O tema vive no layout (a classe vai no <html>), então revalidar só uma rota não bastaria.
  revalidatePath("/", "layout");
  return { ok: true };
}
