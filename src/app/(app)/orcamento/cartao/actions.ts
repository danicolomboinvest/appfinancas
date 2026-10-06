"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { salvarLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";

// Nulo tira o limite. Valor enorme não derruba a tela: corta em vez de recusar.
const limiteSchema = z.number().positive().transform((v) => Math.min(Math.round(v * 100) / 100, 10_000_000)).nullable();

/** Salva (ou tira, com null) o limite do cartão do perfil aberto. */
export async function salvarLimiteDoCartaoAction(valor: number | null): Promise<{ ok: true } | { ok: false }> {
  const r = limiteSchema.safeParse(valor);
  if (!r.success) return { ok: false };
  const ctx = await getRequiredSession();
  await salvarLimiteDoCartao(ctx, r.data);
  // A tela do limite, o atalho no Orçamento e o cartão do Foco.
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal/foco");
  return { ok: true };
}
