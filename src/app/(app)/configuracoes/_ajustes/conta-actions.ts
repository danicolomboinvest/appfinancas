"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const LIMITE = 1_500_000;

/**
 * A foto do perfil (rodada 25): chega já recortada e reduzida pelo navegador (512 px). Fica no
 * banco e só sai pela rota /api/conta/foto, para a dona da conta. O ?v= troca o endereço a cada
 * foto nova, senão o celular mostraria a antiga do cache.
 */
export async function salvarFotoAction(dados: FormData): Promise<{ ok: boolean; erro?: string }> {
  const arquivo = dados.get("foto");
  if (!(arquivo instanceof File)) return { ok: false, erro: "Escolha uma foto." };
  if (!TIPOS.includes(arquivo.type)) return { ok: false, erro: "Use uma foto JPG, PNG ou WebP." };
  if (arquivo.size > LIMITE) return { ok: false, erro: "A foto ficou grande demais. Tente outra." };
  const ctx = await getRequiredSession();
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  await prisma.fotoDaConta.upsert({ where: { userId: ctx.userId }, create: { userId: ctx.userId, tipo: arquivo.type, dados: bytes }, update: { tipo: arquivo.type, dados: bytes, createdAt: new Date() } });
  await prisma.user.update({ where: { id: ctx.userId }, data: { avatarUrl: `/api/conta/foto?v=${Date.now().toString(36)}` } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removerFotoAction(): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  await prisma.fotoDaConta.deleteMany({ where: { userId: ctx.userId } });
  await prisma.user.update({ where: { id: ctx.userId }, data: { avatarUrl: null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Não quero ver ofertas da assessoria". */
export async function ofertasDaAssessoriaAction(desligadas: boolean): Promise<{ ok: boolean }> {
  const v = z.boolean().safeParse(desligadas);
  if (!v.success) return { ok: false };
  const ctx = await getRequiredSession();
  await prisma.user.update({ where: { id: ctx.userId }, data: { ofertasDesligadas: v.data } });
  revalidatePath("/", "layout");
  return { ok: true };
}
