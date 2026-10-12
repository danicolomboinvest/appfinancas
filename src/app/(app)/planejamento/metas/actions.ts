"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal } from "@/lib/repositories/goal.repo";

/** O que o sonho pode mostrar e corrigir: aporte (ou resgate) ligado a ele, do próprio perfil. */
async function guardadoDoSonho(entryId: unknown) {
  const id = z.string().min(1).max(60).parse(entryId);
  const ctx = await getRequiredSession();
  const entrada = await prisma.monthlyEntry.findFirst({
    where: { id, userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null } },
    select: { id: true, goalId: true, amount: true, year: true, month: true, entryDate: true },
  });
  return { ctx, entrada };
}

function revalidarSonho(goalId: string, year: number, month: number) {
  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${goalId}`);
  revalidatePath(`/mensal/${year}/${month}`);
  revalidatePath("/mensal/foco");
}

/**
 * Corrige um "Guardei R$ X em outubro" no próprio registro: valor e mês (01/10/2026). Antes não
 * havia onde: a cliente foi parar no "Já guardado" do formulário e apagou dado para desfazer o
 * erro. O total do sonho é calculado a partir destes lançamentos, então ele refaz a conta sozinho.
 */
export async function editarGuardadoDoSonhoAction(entryId: string, valor: number, mes: string): Promise<{ error?: string }> {
  const { entrada } = await guardadoDoSonho(entryId);
  if (!entrada?.goalId) return { error: "Esse registro não existe mais. Recarregue a página." };
  const amount = z.number().positive("O valor precisa ser maior que zero.").max(1e10).safeParse(valor);
  if (!amount.success) return { error: amount.error.issues[0]?.message ?? "Valor inválido." };
  const ym = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!ym || Number(ym[2]) < 1 || Number(ym[2]) > 12) return { error: "Escolha o mês." };
  const year = Number(ym[1]);
  const month = Number(ym[2]);
  // Mudou de mês: a data antiga (dia 10 de outubro) mentiria no mês novo. Fica o mesmo dia, se existir.
  let entryDate = entrada.entryDate;
  if (entryDate && (entrada.year !== year || entrada.month !== month)) {
    const dia = Math.min(entryDate.getDate(), new Date(year, month, 0).getDate());
    entryDate = new Date(year, month - 1, dia, 12);
  }
  // Resgate (guardado negativo) continua resgate: o valor digitado é sempre positivo.
  const sinal = Number(entrada.amount) < 0 ? -1 : 1;
  await prisma.monthlyEntry.update({ where: { id: entrada.id }, data: { amount: sinal * amount.data, year, month, entryDate } });
  revalidarSonho(entrada.goalId, entrada.year, entrada.month);
  revalidarSonho(entrada.goalId, year, month);
  return {};
}

export async function excluirGuardadoDoSonhoAction(entryId: string): Promise<{ error?: string }> {
  const { ctx, entrada } = await guardadoDoSonho(entryId);
  if (!entrada?.goalId) return { error: "Esse registro não existe mais. Recarregue a página." };
  await prisma.monthlyEntry.deleteMany({ where: { id: entrada.id, userId: ctx.userId, profileId: ctx.profileId } });
  // Era o "Guardei em outubro" do mês: sem outro guardado no mesmo mês, o botão volta, em vez de
  // continuar dizendo "feito" de um dinheiro que ela acabou de tirar.
  const chave = `${entrada.year}-${String(entrada.month).padStart(2, "0")}`;
  const outro = await prisma.monthlyEntry.count({
    where: { userId: ctx.userId, profileId: ctx.profileId, goalId: entrada.goalId, category: "INVESTMENT_CONTRIBUTION", amount: { gt: 0 }, year: entrada.year, month: entrada.month },
  });
  if (outro === 0) await prisma.goal.updateMany({ where: { id: entrada.goalId, userId: ctx.userId, profileId: ctx.profileId, checkinDismissedMonth: chave }, data: { checkinDismissedMonth: null } });
  revalidarSonho(entrada.goalId, entrada.year, entrada.month);
  return {};
}

/**
 * "Guardar antes e comprar depois" vira sonho de verdade, direto do "Posso comprar?" (01/10/2026):
 * o nome da compra, o valor à vista e o prazo que a conta sugeriu. Sem isso a sugestão ficava só
 * no texto e ninguém voltava para criar a meta.
 */
export async function criarSonhoDaCompraAction(input: { nome: string; alvo: number; meses: number }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  const nome = (input.nome ?? "").trim().slice(0, 60) || "Compra planejada";
  const alvo = Number(input.alvo);
  const meses = Math.round(Number(input.meses));
  if (!(alvo > 0) || alvo > 1e9) return { ok: false, error: "Valor inválido." };
  if (!(meses >= 1 && meses <= 120)) return { ok: false, error: "Prazo inválido." };
  const hoje = new Date();
  const targetDate = new Date(hoje.getFullYear(), hoje.getMonth() + meses, 1, 12);
  const meta = await createGoal(ctx, { name: nome.charAt(0).toUpperCase() + nome.slice(1), targetAmount: alvo, targetDate, currentAmount: 0, annualRate: 0, icon: "GENERICO" });
  revalidatePath("/planejamento/metas");
  revalidatePath("/mensal/foco");
  return { ok: true, id: meta.id };
}
