"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal, deleteOwnGoal, updateOwnGoal, getGoalWithProgress } from "@/lib/repositories/goal.repo";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
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

  if (parsed.data.decision === "done") {
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
    where: { id: goal.id, userId: ctx.userId },
    data: { checkinDismissedMonth: parsed.data.monthKey },
  });

  revalidatePath("/planejamento/metas");
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
