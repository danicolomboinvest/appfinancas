"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
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

export async function criarPerfilAction(input: NovoPerfil): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
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
  return tentar(() => updateProfile(ctx, id, input));
}

export async function trocarPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  return tentar(() => switchProfile(ctx, id));
}

export async function excluirPerfilAction(id: string): Promise<ResultadoPerfil> {
  const ctx = await getRequiredSession();
  return tentar(() => deleteProfile(ctx, id));
}
