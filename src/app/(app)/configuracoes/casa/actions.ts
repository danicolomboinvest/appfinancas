"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { marcarAvisoDaMigracaoVisto, marcarTutorialDoCasalVisto, salvarNomesDaCasa } from "@/lib/repositories/casa.repo";

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

/** "Como funciona o casal" visto (terminou ou pulou): não abre mais sozinho para esta conta. */
export async function marcarTutorialDoCasalVistoAction(): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  return { ok: await marcarTutorialDoCasalVisto(ctx) };
}

/** "O casal ficou mais simples" visto: não abre mais. "Agora não" também fecha o tutorial. */
export async function marcarAvisoDaMigracaoVistoAction(como: "ver" | "agora-nao"): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  return { ok: await marcarAvisoDaMigracaoVisto(ctx, como === "agora-nao") };
}
