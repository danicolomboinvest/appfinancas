"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { marcarDaCasa, marcarSoMeu } from "@/lib/repositories/casa.repo";

/**
 * "Só meu" no lançamento aberto (Casal simples, 13/10/2026): um toque e o gasto some do app do
 * par e dos totais dele. Só no que é de quem está logado (o filtro do repositório garante).
 */
export async function marcarSoMeuAction(id: string, soMeu: boolean): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const r = await marcarSoMeu(ctx, String(id), soMeu === true);
  if (!r) return { ok: false };
  revalidatePath(`/mensal/${r.year}/${r.month}`);
  revalidatePath("/mensal/periodo");
  revalidatePath("/mensal/foco", "layout");
  revalidatePath("/orcamento", "layout");
  return { ok: true };
}

/** Um toque troca "Da casa" e "Meu" (Casal simples): só o da casa entra no acerto, e o app aprende com o comerciante. */
export async function marcarDaCasaAction(id: string, daCasa: boolean): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const r = await marcarDaCasa(ctx, String(id), daCasa === true);
  if (!r) return { ok: false };
  revalidatePath(`/mensal/${r.year}/${r.month}`);
  revalidatePath("/mensal/periodo");
  revalidatePath("/mensal/foco", "layout");
  return { ok: true };
}
