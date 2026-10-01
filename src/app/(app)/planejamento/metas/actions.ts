"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal, deleteOwnGoal, updateOwnGoal, getGoalWithProgress } from "@/lib/repositories/goal.repo";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { aporteDoMesFeito } from "@/lib/planning/goal-checkin";
import { goalSchema } from "@/lib/validations/goal.schema";

export type GoalFormState = { error?: string };

function parseGoalForm(formData: FormData) {
  return goalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate"),
    currentAmount: formData.get("currentAmount"),
    annualRate: formData.get("annualRate"),
    icon: formData.get("icon") || undefined,
  });
}

export async function createGoalAction(_prevState: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await createGoal(ctx, parsed.data);
  revalidatePath("/planejamento/metas");
  return {};
}

export async function updateGoalAction(
  id: string,
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnGoal(ctx, id, parsed.data);
  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${id}`);
  return {};
}

export async function deleteGoalAction(id: string) {
  const ctx = await getRequiredSession();
  await deleteOwnGoal(ctx, id);
  revalidatePath("/planejamento/metas");
  redirect("/planejamento/metas");
}

export type GoalCheckinState = { error?: string; ok?: boolean };

const checkinSchema = z.object({
  goalId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  decision: z.enum(["done", "partial", "none"]),
  amount: z.coerce.number().positive().optional(),
});

/**
 * Registra a resposta do check-in mensal ("fez o aporte sugerido?"). É o que torna o status
 * da meta honesto: "fiz" ou "fiz parcial" viram um MonthlyEntry de verdade vinculado à meta
 * (o mesmo caminho que já alimenta o progresso real); "não fiz" não cria nada — a meta
 * simplesmente não cresce nesse mês, e a projeção reflete isso sem maquiagem. De qualquer
 * jeito, marca o mês como respondido pra não perguntar de novo.
 */
export async function checkinGoalAction(
  _prevState: GoalCheckinState,
  formData: FormData,
): Promise<GoalCheckinState> {
  const parsed = checkinSchema.safeParse({
    goalId: formData.get("goalId"),
    monthKey: formData.get("monthKey"),
    decision: formData.get("decision"),
    amount: formData.get("amount") || undefined,
  });
  if (!parsed.success) {
    return { error: "Não consegui registrar. Tente de novo." };
  }
  if (parsed.data.decision === "partial" && !parsed.data.amount) {
    return { error: "Informe quanto você guardou." };
  }

  const ctx = await getRequiredSession();
  const goal = await getGoalWithProgress(ctx, parsed.data.goalId);
  if (!goal) return { error: "Meta não encontrada." };

  const [year, month] = parsed.data.monthKey.split("-").map(Number);

  // "Fiz o aporte" quando o aporte do mês JÁ existe é confirmação, não um segundo aporte: o
  // mês já respondido (outra aba, página velha do cache) ou um aporte da meta neste mês lançado
  // no Fluxo ou importado do extrato. Antes o app criava outro lançamento do mesmo valor e a
  // meta e o total do mês dobravam. "Outro valor" continua criando: ali ela digitou a quantia.
  const aporteJaFeito =
    parsed.data.decision === "done" &&
    aporteDoMesFeito({
      checkinDismissedMonth: goal.checkinDismissedMonth,
      monthKey: parsed.data.monthKey,
      temAporteNoMes:
        (await prisma.monthlyEntry.count({
          // amount > 0: um resgate da meta no mês não é "já aportou".
          where: { userId: ctx.userId, profileId: ctx.profileId, goalId: goal.id, category: "INVESTMENT_CONTRIBUTION", amount: { gt: 0 }, year, month },
        })) > 0,
    });

  if (parsed.data.decision === "done" && !aporteJaFeito) {
    // Recalcula o aporte sugerido no SERVIDOR (nunca confia num valor vindo do cliente pra
    // criar um lançamento financeiro real) — mesma fórmula que a tela usa pra mostrar.
    const plan = computeGoalPlan({
      targetAmount: Number(goal.targetAmount),
      currentAmount: goal.computedCurrentAmount,
      targetDate: goal.targetDate ?? new Date(),
      annualRate: Number(goal.annualRate ?? 0),
    });
    if (plan.requiredMonthlyContribution > 0) {
      await createMonthlyEntry(ctx, {
        year,
        month,
        category: "INVESTMENT_CONTRIBUTION",
        description: `Aporte confirmado — ${goal.name}`,
        amount: plan.requiredMonthlyContribution,
        goalId: goal.id,
      });
    }
  } else if (parsed.data.decision === "partial" && parsed.data.amount) {
    await createMonthlyEntry(ctx, {
      year,
      month,
      category: "INVESTMENT_CONTRIBUTION",
      description: `Aporte parcial — ${goal.name}`,
      amount: parsed.data.amount,
      goalId: goal.id,
    });
  }
  // decision === "none": nenhum lançamento — a meta não avança este mês, de propósito.

  await prisma.goal.updateMany({
    where: { id: goal.id, userId: ctx.userId, profileId: ctx.profileId },
    data: { checkinDismissedMonth: parsed.data.monthKey },
  });

  revalidatePath("/planejamento/metas");
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

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
  revalidatePath("/dashboard");
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
