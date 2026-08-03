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

export type TravelGoalState = { error?: string; created?: boolean; goalName?: string };

const legSchema = z.object({
  destinationKey: z.string().min(1),
  days: z.coerce.number().int().min(TRIP_LIMITS.minDays).max(TRIP_LIMITS.maxDaysPerLeg),
});

const extraSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria.").max(40, "Nome muito longo."),
  value: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
});

const tripSchema = z.object({
  travelers: z.coerce
    .number()
    .int()
    .min(TRIP_LIMITS.minTravelers, "Pelo menos 1 viajante.")
    .max(TRIP_LIMITS.maxTravelers, "Máximo 10 viajantes."),
  // input type="month" → "YYYY-MM"
  tripMonth: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês da viagem."),
  // Valores por categoria como a pessoa deixou (editáveis na tela; o servidor saneia de novo).
  flights: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  lodging: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  food: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
  activities: z.coerce.number().min(0).max(MAX_CATEGORY_VALUE, "Valor alto demais."),
});

/** Listas dinâmicas (destinos e categorias extras) viajam serializadas — FormData não tem forma
 * boa de mandar array de objetos. JSON inválido = payload adulterado, rejeita. */
function parseJsonField<T>(raw: FormDataEntryValue | null, schema: z.ZodType<T>): T | "invalid" | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : "invalid";
  } catch {
    return "invalid";
  }
}

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

/** "Viagem: Paris" com um destino; "Viagem: Paris e Roma" com dois; "Viagem: Paris +2" acima. */
function goalNameFor(labels: string[]): string {
  if (labels.length === 1) return `Viagem: ${labels[0]}`;
  if (labels.length === 2) return `Viagem: ${labels[0]} e ${labels[1]}`;
  return `Viagem: ${labels[0]} +${labels.length - 1}`;
}

/**
 * Cria a meta da viagem: os valores por categoria (incluindo os editados pela pessoa e as
 * categorias extras criadas por ela) são saneados AQUI no servidor e o total (com a margem de
 * 10%) recalculado — nunca se confia num total pronto vindo do cliente. Data-alvo = dia 1º do
 * mês da viagem, o dinheiro precisa estar na mão ANTES de embarcar.
 */
export async function createTravelGoalAction(_prev: TravelGoalState, formData: FormData): Promise<TravelGoalState> {
  const parsed = tripSchema.safeParse({
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

  const legs = parseJsonField(formData.get("legs"), z.array(legSchema).min(1).max(TRIP_LIMITS.maxLegs));
  if (legs === "invalid") return { error: "Destinos inválidos." };
  if (!legs) return { error: "Escolha pelo menos um destino." };

  const destinations = legs.map((leg) => findDestination(leg.destinationKey)).filter((dest) => dest !== null);
  if (destinations.length === 0) return { error: "Escolha pelo menos um destino." };

  const extras = parseJsonField(formData.get("extras"), z.array(extraSchema).max(MAX_EXTRA_CATEGORIES));
  if (extras === "invalid") return { error: "Categorias extras inválidas." };

  const { total } = computeTripTotals([
    clampCategoryValue(parsed.data.flights),
    clampCategoryValue(parsed.data.lodging),
    clampCategoryValue(parsed.data.food),
    clampCategoryValue(parsed.data.activities),
    ...(extras ?? []).map((extra) => clampCategoryValue(extra.value)),
  ]);
  if (total <= 0) return { error: "O custo da viagem precisa ser maior que zero." };

  const [year, month] = parsed.data.tripMonth.split("-").map(Number);
  const targetDate = new Date(year, month - 1, 1, 12);
  if (targetDate.getTime() <= Date.now()) {
    return { error: "Escolha um mês no futuro." };
  }

  const ctx = await getRequiredSession();
  const name = goalNameFor(destinations.map((dest) => dest.label));
  await createGoal(ctx, {
    name,
    targetAmount: total,
    targetDate,
    currentAmount: 0,
    annualRate: await defaultAnnualRate(ctx.userId),
    icon: "VIAGEM",
  });

  revalidatePath("/planejamento/metas");
  return { created: true, goalName: name };
}
