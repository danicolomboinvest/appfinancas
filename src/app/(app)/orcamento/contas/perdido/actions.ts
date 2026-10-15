"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { cacarDinheiroPerdido } from "@/lib/dinheiro-perdido/detectar";
import { ESTADOS, type EstadoDoAchado } from "@/lib/dinheiro-perdido/placar";
import { chavesDasAssinaturasDela, decidirAchado, lancamentosParaCacar, listarAchadosGuardados, marcarAchadosVistos } from "@/lib/repositories/dinheiro-perdido.repo";
import { desfazerAssinatura, responderAssinatura, revalidarAssinaturas } from "@/lib/assinaturas/respostas";
import { marcasDoAchado, noDinheiroPerdido, respostaDoDinheiroPerdido } from "@/lib/assinaturas/regra";

const decisaoSchema = z.object({
  chave: z.string().min(3).max(160),
  estado: z.enum(ESTADOS as unknown as [string, ...string[]]),
});

/**
 * A escolha numa carta ("Não uso", "Pedir estorno", "Já voltou"...). O achado é recalculado aqui no
 * servidor: o valor que soma no "Até agora" vem do extrato dela, nunca do que a tela mandou.
 *
 * A carta de assinatura passa pela regra única (lib/assinaturas, 15/10/2026): "Não uso" aqui vale
 * no Raio-X ("Vou cancelar") e em Recorrentes ("Para cancelar"); o Desfazer volta à resposta de
 * antes, de qualquer tela, e devolve o estado da carta depois dele.
 */
export async function decidirAchadoAction(input: { chave: string; estado: string }): Promise<{ ok: boolean; estado?: EstadoDoAchado }> {
  const p = decisaoSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const ctx = await getRequiredSession();
  const achado = cacarDinheiroPerdido(await lancamentosParaCacar(ctx), { assinaturasDela: await chavesDasAssinaturasDela(ctx) }).achados.find((a) => a.chave === p.data.chave) ?? null;
  const guardado = achado ? null : ((await listarAchadosGuardados(ctx)).find((g) => g.chave === p.data.chave) ?? null);
  const tipo = achado?.tipo ?? guardado?.tipo ?? null;
  const resposta = tipo === "assinatura" ? respostaDoDinheiroPerdido(p.data.estado) : null;
  if (resposta) {
    const marcas = marcasDoAchado(achado ?? { comerciante: guardado?.dados?.comerciante ?? null, nome: guardado?.nome ?? "", descricaoDoLogo: guardado?.dados?.descricaoDoLogo ?? guardado?.nome ?? null });
    const alvo = { marcas, nome: achado?.nome ?? guardado?.nome ?? null };
    const estado = resposta === "desfazer" ? await desfazerAssinatura(ctx, alvo) : await responderAssinatura(ctx, alvo, resposta);
    revalidarAssinaturas();
    return { ok: true, estado: noDinheiroPerdido(estado).estado };
  }
  const ok = await decidirAchado(ctx, p.data.chave, p.data.estado as (typeof ESTADOS)[number], achado);
  revalidatePath("/orcamento/contas");
  return { ok };
}

/** Ela abriu as cartas: as "novas" deixam de ser novas, e o próximo extrato só avisa o que for novo de verdade. */
export async function marcarVistosAction(): Promise<void> {
  const ctx = await getRequiredSession();
  const { achados } = cacarDinheiroPerdido(await lancamentosParaCacar(ctx), { assinaturasDela: await chavesDasAssinaturasDela(ctx) });
  await marcarAchadosVistos(ctx, achados);
}
