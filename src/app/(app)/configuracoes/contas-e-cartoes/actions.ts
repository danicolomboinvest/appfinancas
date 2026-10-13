"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { mostrarContaParaOPar } from "@/lib/repositories/casa.repo";

/** "Mostrar para <par>" por conta (Casal simples): desligado, a conta inteira some do app do par. */
export async function mostrarContaParaOParAction(chave: string, mostrar: boolean): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const n = await mostrarContaParaOPar(ctx, String(chave).slice(0, 80), mostrar === true);
  revalidatePath("/configuracoes/contas-e-cartoes");
  revalidatePath("/mensal", "layout");
  revalidatePath("/orcamento", "layout");
  return { ok: n > 0 };
}
