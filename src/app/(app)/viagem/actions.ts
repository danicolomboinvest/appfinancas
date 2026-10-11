"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { defaultGoalAnnualRate } from "@/lib/repositories/reference-rate.repo";
import { createGoal, getOwnGoal, updateOwnGoal } from "@/lib/repositories/goal.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { toCurrencyCode } from "@/lib/money";
import { resolveLegDestination, tripGoalTargetDate } from "@/lib/travel/estimates";
import { goalNameFor, parseTripPlan, tripValues, type TripPlan } from "@/lib/travel/assistente";

export type TravelGoalState = { error?: string; goalId?: string; goalName?: string };

/** O plano chega como JSON (FormData não tem jeito bom de mandar lista de objetos). */
function lerPlano(formData: FormData): TripPlan | null {
  const raw = formData.get("plano");
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return parseTripPlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Tudo que a meta precisa, recalculado AQUI a partir do plano: o total nunca vem pronto do
 * navegador. É a mesma conta da tela (`tripValues`), então o alvo da meta é o total que ela viu.
 */
async function montarMeta(ctx: AuthContext, plano: TripPlan) {
  const destinos = plano.legs.map(resolveLegDestination).filter((d) => d !== null);
  if (destinos.length === 0) return { error: "Escolha pelo menos um destino." } as const;

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { currency: true } });
  const { total } = tripValues(plano, { usaEstimativas: toCurrencyCode(user?.currency) === "BRL" });
  if (total <= 0) return { error: "O custo da viagem precisa ser maior que zero." } as const;

  const [year, month] = plano.tripMonth.split("-").map(Number);
  const targetDate = tripGoalTargetDate(plano.tripMonth);
  // A partir do mês que vem (no calendário do Brasil): viagem neste mês não dá mais tempo de juntar.
  const hoje = nowInBrazil();
  if (!targetDate || year * 12 + month <= hoje.getFullYear() * 12 + hoje.getMonth() + 1) {
    return { error: "Escolha um mês no futuro." } as const;
  }
  return { name: goalNameFor(destinos.map((d) => d.label)), total, targetDate } as const;
}

/** Cria a meta da viagem com o plano guardado junto (para o "Editar" voltar ao cartão de embarque). */
export async function createTravelGoalAction(_prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  const plano = lerPlano(formData);
  if (!plano) return { error: "Não consegui ler a viagem. Tente de novo." };
  const ctx = await getRequiredSession();
  const meta = await montarMeta(ctx, plano);
  if ("error" in meta) return { error: meta.error };

  const goal = await createGoal(ctx, {
    name: meta.name,
    targetAmount: meta.total,
    targetDate: meta.targetDate,
    currentAmount: 0,
    annualRate: await defaultGoalAnnualRate(ctx.userId),
    icon: "VIAGEM",
  });
  await prisma.goal.updateMany({ where: { id: goal.id, userId: ctx.userId, profileId: ctx.profileId }, data: { viagem: plano } });

  revalidatePath("/planejamento/metas");
  return { goalId: goal.id, goalName: meta.name };
}

/**
 * A viagem de uma meta que já existe, ajustada pelo "Ajustar" do cartão de embarque: muda o
 * nome, o alvo e a data. O que ela já guardou e a taxa da meta ficam como estão.
 */
export async function updateTravelGoalAction(_prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  const plano = lerPlano(formData);
  const goalId = formData.get("goalId");
  if (!plano || typeof goalId !== "string") return { error: "Não consegui ler a viagem. Tente de novo." };
  const ctx = await getRequiredSession();
  const atual = await getOwnGoal(ctx, goalId);
  if (!atual) return { error: "Não achei essa meta." };
  const meta = await montarMeta(ctx, plano);
  if ("error" in meta) return { error: meta.error };

  await updateOwnGoal(ctx, goalId, {
    name: meta.name,
    targetAmount: meta.total,
    targetDate: meta.targetDate,
    currentAmount: Number(atual.currentAmount),
    annualRate: atual.annualRate !== null ? Number(atual.annualRate) : await defaultGoalAnnualRate(ctx.userId),
    icon: atual.icon,
  });
  await prisma.goal.updateMany({ where: { id: goalId, userId: ctx.userId, profileId: ctx.profileId }, data: { viagem: plano } });

  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${goalId}`);
  return { goalId, goalName: meta.name };
}

/** O botão do cartão de embarque: cria a meta na primeira vez; depois, atualiza a mesma meta. */
export async function salvarViagemAction(prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  return formData.get("goalId") ? updateTravelGoalAction(prev, formData) : createTravelGoalAction(prev, formData);
}
