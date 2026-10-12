"use server";

import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession } from "@/lib/auth/session";
import { contaDaDivisao, contaDaSeparacao, type ModoDaDivisao } from "@/lib/entries/divisao";
import { PARENT_CATEGORIES } from "@/lib/categories";

/**
 * As ações da folha "Transação" (versão nova, protótipo): Dividir com alguém, Separar em
 * categorias, e o "Recebi" do A receber. Trocar categoria e Ignorar usam as ações que já existiam
 * (troca em lote com um id só; apagar com Desfazer).
 */

function revalidar(year: number, month: number) {
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  revalidatePath("/mensal/periodo");
  revalidatePath("/mensal/foco");
  revalidatePath("/orcamento", "layout");
}

async function doPerfil(id: string) {
  const ctx = await getRequiredSession();
  const e = await prisma.monthlyEntry.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  return { ctx, e };
}

const nomeLimpo = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 40);

export async function dividirLancamentoAction(input: { id: string; modo: ModoDaDivisao; pctMeu?: number; volta?: boolean; quem: string }): Promise<{ ok: boolean; erro?: string }> {
  const { e } = await doPerfil(input.id);
  const quem = nomeLimpo(input.quem ?? "");
  if (!e || e.category !== "EXPENSE") return { ok: false, erro: "Só dá para dividir um gasto." };
  if (!quem) return { ok: false, erro: "Escolha com quem." };
  if (!["metade", "parte", "outra"].includes(input.modo)) return { ok: false, erro: "Escolha como dividir." };
  // Já dividido: refaz a conta a partir do total da compra.
  const total = Number(e.amount) + Number(e.parteDeOutro ?? 0);
  const r = contaDaDivisao(total, input.modo, input.pctMeu, input.volta !== false);
  await prisma.monthlyEntry.update({
    where: { id: e.id },
    data: { amount: new Prisma.Decimal(r.minha), divididoCom: quem, parteDeOutro: r.dela > 0 ? new Prisma.Decimal(r.dela) : null, devolvidoEm: null },
  });
  revalidar(e.year, e.month);
  return { ok: true };
}

export async function desfazerDivisaoAction(id: string): Promise<{ ok: boolean }> {
  const { e } = await doPerfil(id);
  if (!e || !e.divididoCom) return { ok: false };
  await prisma.monthlyEntry.update({
    where: { id: e.id },
    data: { amount: new Prisma.Decimal(Number(e.amount) + Number(e.parteDeOutro ?? 0)), divididoCom: null, parteDeOutro: null, devolvidoEm: null },
  });
  revalidar(e.year, e.month);
  return { ok: true };
}

/** "Recebi": tudo o que essa pessoa devia neste perfil volta (o Pix abate, não é renda). */
export async function marcarRecebidoAction(pessoa: string): Promise<{ ok: boolean; desfazer: string[] }> {
  const ctx = await getRequiredSession();
  const alvo = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, divididoCom: nomeLimpo(pessoa), devolvidoEm: null, parteDeOutro: { gt: 0 } },
    select: { id: true },
  });
  const ids = alvo.map((a) => a.id);
  if (ids.length) await prisma.monthlyEntry.updateMany({ where: { id: { in: ids } }, data: { devolvidoEm: new Date() } });
  revalidatePath("/mensal", "layout");
  return { ok: true, desfazer: ids };
}

export async function desfazerRecebidoAction(ids: string[]): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  await prisma.monthlyEntry.updateMany({ where: { id: { in: ids.slice(0, 500) }, userId: ctx.userId, profileId: ctx.profileId }, data: { devolvidoEm: null } });
  revalidatePath("/mensal", "layout");
  return { ok: true };
}

/**
 * "Separar em categorias": a primeira parte fica no lançamento, com a categoria dele; o resto vira
 * um lançamento novo, no mesmo dia, com a outra categoria.
 */
export async function separarLancamentoAction(input: {
  id: string;
  primeira: number;
  outra: { parentCategory: string | null; customCategoryId: string | null };
}): Promise<{ ok: boolean; erro?: string }> {
  const { ctx, e } = await doPerfil(input.id);
  if (!e || e.category !== "EXPENSE") return { ok: false, erro: "Só dá para separar um gasto." };
  const { v1, v2 } = contaDaSeparacao(Number(e.amount), input.primeira);
  if (v1 <= 0 || v2 <= 0) return { ok: false, erro: "As duas partes precisam ter valor." };
  let parent: ParentCategory | null = null;
  let custom: string | null = null;
  if (input.outra.customCategoryId) {
    const c = await prisma.customCategory.findFirst({ where: { id: input.outra.customCategoryId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } });
    if (!c) return { ok: false, erro: "Categoria não encontrada." };
    custom = c.id;
  } else if (input.outra.parentCategory && (PARENT_CATEGORIES as readonly string[]).includes(input.outra.parentCategory)) {
    parent = input.outra.parentCategory as ParentCategory;
  } else return { ok: false, erro: "Escolha a categoria do resto." };
  await prisma.$transaction([
    prisma.monthlyEntry.update({ where: { id: e.id }, data: { amount: new Prisma.Decimal(v1) } }),
    prisma.monthlyEntry.create({
      data: {
        userId: e.userId,
        profileId: e.profileId,
        year: e.year,
        month: e.month,
        category: "EXPENSE",
        parentCategory: parent,
        customCategoryId: custom,
        description: e.description,
        amount: new Prisma.Decimal(v2),
        entryDate: e.entryDate,
        importBatchId: e.importBatchId,
        noCartao: e.noCartao,
        pessoa: e.pessoa,
        doCasal: e.doCasal,
        autorUserId: e.autorUserId,
        soMeu: e.soMeu,
      },
    }),
  ]);
  revalidar(e.year, e.month);
  return { ok: true };
}
