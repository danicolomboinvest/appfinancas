"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { temAdicional } from "@/lib/adicionais/acesso";
import type { Adicional } from "@/lib/adicionais/config";
import {
  createProfile, updateProfile, switchProfile, deleteProfile, listProfiles, type NovoPerfil,
} from "@/lib/repositories/profile.repo";
import { podeCriar } from "@/lib/perfis/lugares";
import { extrasLiberados } from "@/lib/perfis/extras-liberados";

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

/**
 * Trocar de perfil muda TUDO que a pessoa vê, então revalida a aplicação inteira.
 *
 * Revalidar só a rota atual deixaria o cache das outras telas com os números do perfil
 * anterior — a pessoa trocaria para a Empresa, iria ao Orçamento e veria o orçamento pessoal.
 */
function revalidarTudo() {
  revalidatePath("/", "layout");
}

async function tentar(fn: () => Promise<void>): Promise<ResultadoPerfil> {
  try {
    await fn();
    revalidarTudo();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não consegui fazer isso agora." };
  }
}

/**
 * Os perfis Empresa e Casal são adicionais pagos à parte desde o lançamento (ver lib/adicionais):
 * Empresa pelo "perfil_empresa" e Casal (o Nós dois) pela "conta_parceiro", que leva o login do
 * par junto. Quem não tem vai para a tela de compra. Fica aqui no servidor, e não no formulário,
 * para valer em qualquer tela que crie, transforme ou abra um perfil. Antes do lançamento,
 * temAdicional responde sempre que sim e nada muda. O redirect fica fora do try (ver `tentar`):
 * ele funciona lançando um erro especial.
 */
const ADICIONAL_DO_TIPO: Partial<Record<string, Adicional>> = { EMPRESA: "perfil_empresa", CASAL: "conta_parceiro" };

async function exigirAdicional(userId: string, kind: string | null | undefined) {
  const adicional = kind ? ADICIONAL_DO_TIPO[kind] : undefined;
  if (adicional && !(await temAdicional(userId, adicional))) redirect(`/adicionais/${adicional}`);
}

export async function criarPerfilAction(input: NovoPerfil): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  // Extra que ela não pagou: vai para a compra (antes de olhar os lugares, para não cair no aviso
  // de limite).
  await exigirAdicional(ctx.userId, input.kind);
  // No máximo 3 perfis, um de cada (decisão da dona, 11/10, rodada 74): Pessoal, Nós dois e
  // Empresa. Quem já tem mais mantém; só não cria outro além do lugar vazio e liberado.
  const [perfis, liberados] = await Promise.all([listProfiles(ctx.userId), extrasLiberados(ctx.userId)]);
  if (!podeCriar(input.kind ?? "PESSOAL", perfis, liberados)) {
    return { ok: false, error: "Cada conta tem até 3 perfis: Pessoal, Nós dois e Empresa. Veja em Configurações › Perfis." };
  }
  return tentar(async () => {
    const novo = await createProfile(ctx.userId, input);
    // Quem acabou de criar um perfil quer entrar nele: seria estranho criar "Empresa" e
    // continuar vendo o Pessoal.
    await switchProfile(ctx, novo.id);
  });
}

export async function editarPerfilAction(id: string, input: Partial<NovoPerfil>): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  if (input.kind && ADICIONAL_DO_TIPO[input.kind]) {
    const atual = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { kind: true } });
    if (atual && atual.kind !== input.kind) await exigirAdicional(ctx.userId, input.kind);
  }
  return tentar(() => updateProfile(ctx, id, input));
}

export async function trocarPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  // Quem deixou de pagar o adicional não perde os dados (da empresa ou do casal), mas para de abrir
  // o perfil até renovar. Cliente de antes do lançamento tem os dois para sempre (ver acesso.ts).
  const alvo = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { kind: true } });
  await exigirAdicional(ctx.userId, alvo?.kind);
  return tentar(() => switchProfile(ctx, id));
}

export async function excluirPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  return tentar(() => deleteProfile(ctx, id));
}
