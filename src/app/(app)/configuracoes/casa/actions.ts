"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { salvarNomesDaCasa } from "@/lib/repositories/casa.repo";

const limpo = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 30);

/** Os nomes da casa (o meu e o do par), que aparecem nas bolinhas, nos filtros e no acerto. */
export async function salvarNomesDaCasaAction(nomeEu: string, nomeOutro: string): Promise<{ ok: boolean; mensagem?: string }> {
  const ctx = await getRequiredSession();
  const [eu, outro] = [limpo(nomeEu), limpo(nomeOutro)];
  if (!eu || !outro) return { ok: false, mensagem: "Escreva os dois nomes." };
  const ok = await salvarNomesDaCasa(ctx, eu, outro);
  revalidatePath("/", "layout");
  return { ok };
}
