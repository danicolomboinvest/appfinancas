"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { temAdicional } from "@/lib/adicionais/acesso";
import {
  createProfile, updateProfile, switchProfile, deleteProfile, type NovoPerfil,
} from "@/lib/repositories/profile.repo";

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
 * O perfil Empresa é um adicional pago à parte desde o lançamento (ver lib/adicionais). Quem não
 * tem vai para a tela de compra. Fica aqui no servidor, e não no formulário, para valer em
 * qualquer tela que crie, transforme ou abra um perfil. Antes do lançamento, temAdicional
 * responde sempre que sim e nada muda. O redirect fica fora do try (ver `tentar`): ele funciona
 * lançando um erro especial.
 */
async function exigirEmpresa(userId: string) {
  if (!(await temAdicional(userId, "perfil_empresa"))) redirect("/adicionais/perfil_empresa");
}

export async function criarPerfilAction(input: NovoPerfil): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  if (input.kind === "EMPRESA") await exigirEmpresa(ctx.userId);
  return tentar(async () => {
    const novo = await createProfile(ctx.userId, input);
    // Quem acabou de criar um perfil quer entrar nele: seria estranho criar "Empresa" e
    // continuar vendo o Pessoal.
    await switchProfile(ctx, novo.id);
  });
}

export async function editarPerfilAction(id: string, input: Partial<NovoPerfil>): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  if (input.kind === "EMPRESA") {
    const atual = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { kind: true } });
    if (atual && atual.kind !== "EMPRESA") await exigirEmpresa(ctx.userId);
  }
  return tentar(() => updateProfile(ctx, id, input));
}

export async function trocarPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  // Quem deixou de pagar o adicional não perde os dados da empresa, mas para de abrir o perfil
  // até renovar.
  const alvo = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { kind: true } });
  if (alvo?.kind === "EMPRESA") await exigirEmpresa(ctx.userId);
  return tentar(() => switchProfile(ctx, id));
}

export async function excluirPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  return tentar(() => deleteProfile(ctx, id));
}
