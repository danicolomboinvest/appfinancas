"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { gravarComeco, lerComecoDaConta } from "@/lib/repositories/comeco.repo";
import { alternarPasso, lerComeco, PASSOS_PRIMEIROS, type Comeco, type PrimeiroPasso } from "@/lib/onboarding/comeco";

/**
 * O que a Visão geral muda no começo de quem acabou de entrar: fechar o "aha", marcar um dos
 * Primeiros passos à mão e fechar o cartão depois dos cinco. Quem nunca passou pelo começo novo
 * e vê os Primeiros passos na Visão geral vazia (12/10/2026) ganha um começo na primeira marca.
 */
function comecoOuNovo(c: Comeco | null): Comeco {
  return c ?? lerComeco({ passo: "porta", terminouEm: new Date().toISOString() })!;
}
export async function fecharAhaAction(): Promise<void> {
  const ctx = await getRequiredSession();
  const c = await lerComecoDaConta(ctx.userId);
  if (!c) return;
  await gravarComeco(ctx.userId, { ...c, aha: false });
  revalidatePath("/mensal/foco");
}

export async function alternarPrimeiroPassoAction(chave: string): Promise<void> {
  if (!(PASSOS_PRIMEIROS as readonly string[]).includes(chave)) return;
  const ctx = await getRequiredSession();
  const c = comecoOuNovo(await lerComecoDaConta(ctx.userId));
  await gravarComeco(ctx.userId, alternarPasso(c, chave as PrimeiroPasso));
  revalidatePath("/mensal/foco");
}

export async function fecharPrimeirosPassosAction(): Promise<void> {
  const ctx = await getRequiredSession();
  const c = comecoOuNovo(await lerComecoDaConta(ctx.userId));
  await gravarComeco(ctx.userId, { ...c, passosFechados: true });
  revalidatePath("/mensal/foco");
}
