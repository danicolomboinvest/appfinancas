"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { comecarReset, lerReset, marcarDiaFeito, salvarResposta, type CampoDeResposta } from "@/lib/repositories/money-reset.repo";

async function comAcesso(): Promise<AuthContext> {
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) throw new Error("Sem acesso ao Money Reset.");
  return ctx;
}

function revalidar(dia?: number) {
  revalidatePath("/money-reset");
  if (dia) revalidatePath(`/money-reset/dia/${dia}`);
  revalidatePath("/mensal/foco");
}

export async function comecarResetAction(separado: boolean[]) {
  const ctx = await comAcesso();
  await comecarReset(ctx, z.array(z.boolean()).max(10).parse(separado));
  revalidar();
}

/**
 * Marca a missão feita. Só a missão aberta hoje (a de amanhã espera o dia dela); a Dani (ADMIN)
 * pode marcar qualquer uma, pra conferir o programa sem esperar 21 dias.
 */
export async function concluirMissaoAction(dia: number): Promise<boolean> {
  const ctx = await comAcesso();
  const d = z.number().int().min(1).max(21).parse(dia);
  const reset = await lerReset(ctx);
  const liberada = reset.estado.atual === d && reset.estado.disponivel;
  if (!liberada && ctx.role !== "ADMIN") return false;
  await marcarDiaFeito(ctx, d);
  revalidar(d);
  return true;
}

const CAMPOS = ["motivo", "regra", "passos", "desafio", "recompensa", "dica", "negociar", "divisao", "fixas"] as const;

/** Guarda a resposta da missão e, se `concluir`, já marca o dia (o motivo salvo é a missão feita). */
export async function salvarRespostaAction(campo: CampoDeResposta, texto: string, dados?: unknown, concluir?: number): Promise<boolean> {
  const ctx = await comAcesso();
  const c = z.enum(CAMPOS).parse(campo);
  await salvarResposta(ctx, c, z.string().max(2000).parse(texto), dados);
  if (concluir) return concluirMissaoAction(concluir);
  revalidar();
  return true;
}
