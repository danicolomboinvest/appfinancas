"use server";

import { nowInBrazil } from "@/lib/date/brazil-now";

import { definirRendaPlanejada } from "@/lib/repositories/monthly-plan.repo";
import { mesesQueOSalvarGrava } from "@/lib/planning/plano-anual";

import type { EntryCategory, ParentCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateProfile } from "@/lib/repositories/profile.repo";
import { updateOwnCurrency } from "@/lib/repositories/user.repo";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { gravarComeco, lerComecoDaConta, marcarRecebidaSeAinda } from "@/lib/repositories/comeco.repo";
import { isCurrencyCode } from "@/lib/money";
import { isProfileThemeKey } from "@/lib/profiles/themes";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import {
  ehPasso,
  juntarComeco,
  pularComeco,
  terminarComLancamento,
  type MudancaDoComeco,
  type PassoDoComeco,
} from "@/lib/onboarding/comeco";

/**
 * O começo da versão nova (ver lib/onboarding/comeco.ts). Cada resposta é gravada na hora: quem
 * fecha o app no meio volta no mesmo ponto, e quem pula não perde nada do que já respondeu.
 */
export async function salvarComecoAction(mudanca: MudancaDoComeco & { tema?: string; moeda?: string }): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const atual = await lerComecoDaConta(ctx.userId);
  const { tema, moeda, ...resto } = mudanca;
  const novo = juntarComeco(atual, resto);
  await gravarComeco(ctx.userId, novo);
  // A renda do começo vai para o mesmo campo que o "Montar o plano" lê (12/10/2026): o Orçamento
  // não pergunta de novo, só mostra preenchido para ela confirmar. Do mês de agora até dezembro.
  if (resto.renda !== undefined && !novo.semRenda && novo.renda) {
    const agora = nowInBrazil();
    await definirRendaPlanejada(ctx, agora.getFullYear(), novo.renda, mesesQueOSalvarGrava(agora.getFullYear(), agora));
  }
  // O tema vale para o perfil ativo, o mesmo que a tela de perfis muda.
  if (tema && isProfileThemeKey(tema)) await updateProfile(ctx, ctx.profileId, { theme: tema });
  // A moeda escolhida aqui (quem mora fora): antes ela só existia em Configurações.
  if (moeda && isCurrencyCode(moeda)) await updateOwnCurrency(ctx, moeda);
  if (tema || moeda) revalidatePath("/", "layout");
  return { ok: true };
}

/** Pular, de qualquer tela, ou "Faço isso depois": o começo acaba e ela cai na Visão geral. */
export async function pularComecoAction(ondeParou: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const atual = await lerComecoDaConta(ctx.userId);
  const passo: PassoDoComeco = ehPasso(ondeParou) ? ondeParou : "b1";
  await gravarComeco(ctx.userId, pularComeco(atual, passo));
  await marcarRecebidaSeAinda(ctx.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** O extrato entrou (a importação já gravou tudo): o começo termina com o mês na tela. */
export async function terminarComExtratoAction(input: { mes: string | null; revisou: boolean; banco?: string | null }): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const atual = await lerComecoDaConta(ctx.userId);
  const mes = input.mes && /^\d{4}-\d{2}$/.test(input.mes) ? input.mes : null;
  await gravarComeco(ctx.userId, terminarComLancamento(atual, "extrato", { mesDoExtrato: mes, revisou: input.revisou === true, banco: input.banco ?? null }));
  // Sem revalidar aqui: a tela de "Pronto." ainda é do começo, e recarregar o /comecar com a
  // conta já recebida mandaria ela embora antes de ver a confirmação. A Visão geral é dinâmica.
  await marcarRecebidaSeAinda(ctx.userId);
  return { ok: true };
}

const CATEGORIAS: EntryCategory[] = ["EXPENSE", "INCOME", "INVESTMENT_CONTRIBUTION"];

/**
 * O primeiro gasto digitado ou falado, lançado hoje (data de Brasília) no perfil ativo. Valor
 * acima de zero e categoria do app; o resto é texto livre curto.
 */
export async function primeiroGastoAction(input: {
  valor: number;
  descricao: string;
  categoria?: string;
  parentCategory?: string | null;
  sub?: string | null;
  como: "digitado" | "falado";
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const ctx = await getRequiredSession();
  const valor = Math.round(Number(input.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 10_000_000) return { ok: false, erro: "Digite um valor maior que zero." };
  const category = CATEGORIAS.includes(input.categoria as EntryCategory) ? (input.categoria as EntryCategory) : "EXPENSE";
  const parent = input.parentCategory && (PARENT_CATEGORIES as readonly string[]).includes(input.parentCategory) ? (input.parentCategory as ParentCategory) : undefined;
  const hoje = hojeEmBrasilia();
  const dia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 12));
  try {
    await createMonthlyEntry(ctx, {
      year: dia.getUTCFullYear(),
      month: dia.getUTCMonth() + 1,
      category,
      parentCategory: category === "EXPENSE" ? (parent ?? "OUTROS") : undefined,
      subcategory: input.sub?.trim().slice(0, 60) || undefined,
      description: input.descricao.trim().slice(0, 80) || undefined,
      amount: valor,
      entryDate: dia,
    });
  } catch (err) {
    console.error("primeiroGastoAction falhou:", err);
    return { ok: false, erro: "Não consegui salvar. Tente de novo." };
  }
  const atual = await lerComecoDaConta(ctx.userId);
  await gravarComeco(ctx.userId, terminarComLancamento(atual, input.como));
  // Sem revalidar: a confirmação "Lançado." aparece antes de ir para a Visão geral (ver acima).
  await marcarRecebidaSeAinda(ctx.userId);
  return { ok: true };
}
