"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal } from "@/lib/repositories/goal.repo";
import {
  computeTripTotals,
  clampCategoryValue,
  findDestination,
  MAX_CATEGORY_VALUE,
  MAX_EXTRA_CATEGORIES,
  TRIP_LIMITS,
} from "@/lib/travel/estimates";

export type TravelGoalState = { error?: string; created?: boolean };

const tripSchema = z.object({
  destinationKey: z.string().min(1, "Escolha o destino."),
  days: z.coerce.number().int().min(TRIP_LIMITS.minDays, "Mínimo 2 dias.").max(TRIP_LIMITS.maxDays, "Máximo 60 dias."),
  travelers: z.coerce.number().int().min(1, "Pelo menos 1 viajante.").max(TRIP_LIMITS.maxTravelers, "Máximo 10 viajantes."),
  // input type="month" → "YYYY-MM"
  tripMonth: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês da viagem."),
  // Valores por categoria como a pessoa deixou (editáveis na tela; o servidor saneia de novo).
  flights: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  lodging: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  food: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  activities: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
});

const extrasSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Dê um nome à categoria.").max(40, "Nome muito longo."),
      value: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
    }),
  )
  .max(MAX_EXTRA_CATEGORIES, "Máximo de 10 categorias extras.");

export type TripExtra = z.infer<typeof extrasSchema>[number];

/** Taxa anual padrão pra meta, como FRAÇÃO (0.1065 = 10,65% — unidade de taxa do sistema
 * inteiro): o CDI das taxas de referência do app (global ou do usuário); sem CDI cadastrado,
 * 0.08 (8% a.a.) conservador. A pessoa edita na meta depois se quiser. */
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
  return Number.isFinite(rate) && rate > 0 && rate <= 3 ? rate : 0.08;
}

/**
 * Cria a meta "Viagem: X" a partir do plano: os valores por categoria (incluindo os editados
 * pela pessoa e as categorias extras criadas por ela) são saneados AQUI no servidor e o total
 * (com a margem de 10%) recalculado — nunca se confia num total pronto vindo do cliente.
 * Data-alvo = dia 1º do mês da viagem, o dinheiro precisa estar na mão ANTES de embarcar.
 */
export async function createTravelGoalAction(_prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  const parsed = tripSchema.safeParse({
    destinationKey: formData.get("destinationKey"),
    days: formData.get("days"),
    travelers: formData.get("travelers"),
    tripMonth: formData.get("tripMonth"),
    flights: formData.get("flights"),
    lodging: formData.get("lodging"),
    food: formData.get("food"),
    activities: formData.get("activities"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const destination = findDestination(parsed.data.destinationKey);
  if (!destination) return { error: "Destino inválido." };

  // Categorias extras chegam serializadas (a lista é dinâmica; FormData não tem forma boa de
  // mandar array de objetos). JSON inválido = payload adulterado, rejeita.
  let extras: TripExtra[] = [];
  const extrasRaw = formData.get("extras");
  if (typeof extrasRaw === "string" && extrasRaw.trim()) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extrasRaw);
    } catch {
      return { error: "Categorias extras inválidas." };
    }
    const parsedExtras = extrasSchema.safeParse(parsedJson);
    if (!parsedExtras.success) {
      return { error: parsedExtras.error.issues[0]?.message ?? "Categorias extras inválidas." };
    }
    extras = parsedExtras.data;
  }

  const { total } = computeTripTotals([
    clampCategoryValue(parsed.data.flights),
    clampCategoryValue(parsed.data.lodging),
    clampCategoryValue(parsed.data.food),
    clampCategoryValue(parsed.data.activities),
    ...extras.map((e) => clampCategoryValue(e.value)),
  ]);
  if (total <= 0) return { error: "O custo da viagem precisa ser maior que zero." };

  const [year, month] = parsed.data.tripMonth.split("-").map(Number);
  const targetDate = new Date(year, month - 1, 1, 12);
  if (targetDate.getTime() <= Date.now()) {
    return { error: "Escolha um mês no futuro." };
  }

  const ctx = await getRequiredSession();
  await createGoal(ctx, {
    name: `Viagem: ${destination.label}`,
    targetAmount: total,
    targetDate,
    currentAmount: 0,
    annualRate: await defaultAnnualRate(ctx.userId),
    icon: "VIAGEM",
  });

  revalidatePath("/planejamento/metas");
  return { created: true };
}
