"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { casalParaOConvite, marcarAvisoDoPerfilCompradoVisto } from "@/lib/repositories/perfil-comprado.repo";
import { trocarPerfilAction, type ResultadoPerfil } from "./actions";

/** "Depois" no aviso do perfil comprado: não abre mais sozinho. */
export async function depoisDoPerfilCompradoAction(tipo: "empresa" | "casal"): Promise<void> {
  const ctx = await getRequiredSession();
  await marcarAvisoDoPerfilCompradoVisto(ctx.userId, tipo === "empresa" ? "empresa" : "casal");
}

/** "Abrir a Empresa": marca o aviso como visto e troca para a Empresa (a tela abre o assistente). */
export async function abrirEmpresaCompradaAction(perfilId: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  await marcarAvisoDoPerfilCompradoVisto(ctx.userId, "empresa");
  const empresa = await prisma.financialProfile.findFirst({ where: { id: perfilId, userId: ctx.userId, kind: "EMPRESA" }, select: { id: true } });
  if (!empresa) return { ok: false, error: "Não achei a Empresa. Veja em Configurações › Perfis." };
  return trocarPerfilAction(empresa.id);
}

/** "Convidar meu par": entra no perfil Casal (o que ela tem, ou um novo) para o convite do par. */
export async function convidarParCompradoAction(): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  await marcarAvisoDoPerfilCompradoVisto(ctx.userId, "casal");
  const casalId = await casalParaOConvite(ctx.userId);
  if (!casalId) return { ok: false, error: "Cada conta tem até 3 perfis: Pessoal, Nós dois e Empresa. Veja em Configurações › Perfis." };
  return trocarPerfilAction(casalId);
}
