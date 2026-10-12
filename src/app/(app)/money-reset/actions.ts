"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { CAMPOS_DE_RESPOSTA, lerReset, marcarMarcoFeito, salvarResposta, type CampoDeResposta } from "@/lib/repositories/money-reset.repo";

async function comAcesso(): Promise<AuthContext> {
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) throw new Error("Sem acesso ao Money Reset.");
  return ctx;
}

function revalidar(n?: number) {
  revalidatePath("/money-reset");
  if (n) revalidatePath(`/money-reset/dia/${n}`);
  revalidatePath("/mensal/foco");
}

/**
 * Marca o marco feito. Só o marco aberto agora (a próxima abre assim que a anterior termina);
 * a Dani (ADMIN) pode marcar qualquer um, para conferir o programa sem fazer os 21.
 */
export async function concluirMarcoAction(n: number): Promise<boolean> {
  const ctx = await comAcesso();
  const m = z.number().int().min(1).max(21).parse(n);
  const reset = await lerReset(ctx);
  if (reset.estado.atual !== m && ctx.role !== "ADMIN") return false;
  await marcarMarcoFeito(ctx, m);
  revalidar(m);
  return true;
}

/** Guarda a resposta da missão e, se `concluir`, já marca o marco (o motivo salvo é a missão feita). */
export async function salvarRespostaAction(campo: CampoDeResposta, texto: string, dados?: unknown, concluir?: number): Promise<boolean> {
  const ctx = await comAcesso();
  const c = z.enum(CAMPOS_DE_RESPOSTA as [CampoDeResposta, ...CampoDeResposta[]]).parse(campo);
  await salvarResposta(ctx, c, z.string().max(2000).parse(texto), dados);
  if (concluir) return concluirMarcoAction(concluir);
  revalidar();
  return true;
}
