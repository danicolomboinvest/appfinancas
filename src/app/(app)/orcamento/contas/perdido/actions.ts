"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { cacarDinheiroPerdido } from "@/lib/dinheiro-perdido/detectar";
import { ESTADOS } from "@/lib/dinheiro-perdido/placar";
import { decidirAchado, lancamentosParaCacar, marcarAchadosVistos } from "@/lib/repositories/dinheiro-perdido.repo";

const decisaoSchema = z.object({
  chave: z.string().min(3).max(160),
  estado: z.enum(ESTADOS as unknown as [string, ...string[]]),
});

/**
 * A escolha numa carta ("Não uso", "Pedir estorno", "Já voltou"...). O achado é recalculado aqui no
 * servidor: o valor que soma no "Até agora" vem do extrato dela, nunca do que a tela mandou.
 */
export async function decidirAchadoAction(input: { chave: string; estado: string }): Promise<{ ok: boolean }> {
  const p = decisaoSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const ctx = await getRequiredSession();
  const achado = cacarDinheiroPerdido(await lancamentosParaCacar(ctx)).achados.find((a) => a.chave === p.data.chave) ?? null;
  const ok = await decidirAchado(ctx, p.data.chave, p.data.estado as (typeof ESTADOS)[number], achado);
  revalidatePath("/orcamento/contas");
  return { ok };
}

/** Ela abriu as cartas: as "novas" deixam de ser novas, e o próximo extrato só avisa o que for novo de verdade. */
export async function marcarVistosAction(): Promise<void> {
  const ctx = await getRequiredSession();
  const { achados } = cacarDinheiroPerdido(await lancamentosParaCacar(ctx));
  await marcarAchadosVistos(ctx, achados);
}
