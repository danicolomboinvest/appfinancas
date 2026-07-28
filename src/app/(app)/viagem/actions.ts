"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal } from "@/lib/repositories/goal.repo";
import { estimateTrip, TRIP_LIMITS, type TravelStyle } from "@/lib/travel/estimates";

export type TravelGoalState = { error?: string; created?: boolean };

const tripSchema = z.object({
  destinationKey: z.string().min(1, "Escolha o destino."),
  days: z.coerce.number().int().min(TRIP_LIMITS.minDays, "Mínimo 2 dias.").max(TRIP_LIMITS.maxDays, "Máximo 60 dias."),
  travelers: z.coerce.number().int().min(1, "Pelo menos 1 viajante.").max(TRIP_LIMITS.maxTravelers, "Máximo 10 viajantes."),
  style: z.enum(["economico", "medio", "confortavel"]),
  // input type="month" → "YYYY-MM"
  tripMonth: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês da viagem."),
});

/** Taxa anual padrão pra meta: o CDI configurado nas taxas de referência do app (global ou do
 * usuário); sem CDI cadastrado, 8% a.a. conservador. A pessoa edita na meta depois se quiser. */
async function defaultAnnualRate(userId: string): Promise<number> {
  const cdi = await prisma.referenceRate.findFirst({
    where: {
      OR: [{ userId }, { userId: null }],
      name: { contains: "CDI", mode: "insensitive" },
      basis: { in: ["ANNUAL_252", "ANNUAL_365"] },
    },
    orderBy: [{ userId: "desc" }, { effectiveDate: "desc" }], // taxa do próprio usuário ganha da global
    select: { rateValue: true },
  });
  const rate = cdi ? Number(cdi.rateValue) : NaN;
  return Number.isFinite(rate) && rate > 0 && rate <= 300 ? rate : 8;
}

/**
 * Cria a meta "Viagem: X" a partir do plano: o valor é RECALCULADO aqui no servidor com os
 * mesmos inputs (nunca confia num total vindo do cliente). Data-alvo = dia 1º do mês da
 * viagem — o dinheiro precisa estar na mão ANTES de embarcar.
 */
export async function createTravelGoalAction(_prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  const parsed = tripSchema.safeParse({
    destinationKey: formData.get("destinationKey"),
    days: formData.get("days"),
    travelers: formData.get("travelers"),
    style: formData.get("style"),
    tripMonth: formData.get("tripMonth"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const estimate = estimateTrip({
    destinationKey: parsed.data.destinationKey,
    days: parsed.data.days,
    travelers: parsed.data.travelers,
    style: parsed.data.style as TravelStyle,
  });
  if (!estimate) return { error: "Destino inválido." };

  const [year, month] = parsed.data.tripMonth.split("-").map(Number);
  const targetDate = new Date(year, month - 1, 1, 12);
  if (targetDate.getTime() <= Date.now()) {
    return { error: "Escolha um mês no futuro." };
  }

  const ctx = await getRequiredSession();
  await createGoal(ctx, {
    name: `Viagem: ${estimate.destination.label}`,
    targetAmount: estimate.total,
    targetDate,
    currentAmount: 0,
    annualRate: await defaultAnnualRate(ctx.userId),
    icon: "VIAGEM",
  });

  revalidatePath("/planejamento/metas");
  return { created: true };
}
