/**
 * Viagem em assistente (versão nova, 11/10/2026): as contas que a tela de 7 passos usa, todas em
 * cima de `estimates.ts`. Nada aqui tem número próprio de custo: o total da viagem sai de UMA
 * conta só (`estimateTrip` + `computeTripTotals`), a mesma em todos os temas. Nos protótipos
 * cada tema tinha o seu motor e a viagem de exemplo dava um total diferente em cada um
 * (pendência 5.1.9); no app real isso não existe.
 */
import { z } from "zod";
import { computeGoalPlan } from "@/lib/planning/goal";
import {
  clampCategoryValue,
  computeTripTotals,
  estimateTrip,
  MAX_CATEGORY_VALUE,
  MAX_EXTRA_CATEGORIES,
  PLACE_TYPE_LABEL,
  seasonLevelFor,
  TRAVEL_REGIONS,
  TRIP_LIMITS,
  TRIP_PHOTOS,
  tripGoalTargetDate,
  type PlaceType,
  type SeasonLevel,
  type TravelRegion,
  type TravelStyle,
  type TripEstimate,
  type TripLeg,
} from "./estimates";

export type FixedKey = "flights" | "lodging" | "food" | "activities";
export const FIXED_KEYS: FixedKey[] = ["flights", "lodging", "food", "activities"];

/**
 * A viagem inteira como a pessoa montou: é o que a tela guarda enquanto ela anda pelos passos e
 * o que vai junto com a meta (Goal.viagem), para o "Editar" da meta abrir o cartão de embarque.
 */
export type TripPlan = {
  legs: TripLeg[];
  travelers: number;
  style: TravelStyle;
  /** "YYYY-MM" */
  tripMonth: string;
  /** Valores que ela trocou na mão (o resto continua estimado). */
  overrides: Partial<Record<FixedKey, number>>;
  /** "Outro custo": seguro, chip, compras... */
  extras: { name: string; value: number }[];
  /** Foto que ela escolheu para um destino (chave do destino → foto do banco). */
  photos: Record<string, string>;
};

const regionSchema = z.enum(TRAVEL_REGIONS as [TravelRegion, ...TravelRegion[]]);
const placeTypeSchema = z.enum(Object.keys(PLACE_TYPE_LABEL) as [PlaceType, ...PlaceType[]]);
const valueSchema = z.coerce.number().min(0).max(MAX_CATEGORY_VALUE);

export const tripPlanSchema = z.object({
  legs: z
    .array(
      z.object({
        destinationKey: z.string().min(1).max(80),
        days: z.coerce.number().int().min(TRIP_LIMITS.minDays).max(TRIP_LIMITS.maxDaysPerLeg),
        custom: z
          .object({ label: z.string().trim().min(1).max(40), region: regionSchema, placeType: placeTypeSchema })
          .optional(),
      }),
    )
    .min(1)
    .max(TRIP_LIMITS.maxLegs),
  travelers: z.coerce.number().int().min(TRIP_LIMITS.minTravelers).max(TRIP_LIMITS.maxTravelers),
  style: z.enum(["economico", "medio", "confortavel"]),
  tripMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  overrides: z.object({ flights: valueSchema, lodging: valueSchema, food: valueSchema, activities: valueSchema }).partial(),
  extras: z.array(z.object({ name: z.string().trim().max(40), value: valueSchema })).max(MAX_EXTRA_CATEGORIES),
  photos: z.record(z.string().max(80), z.enum(TRIP_PHOTOS)).default({}),
});

/** Lê uma viagem guardada (JSON da meta ou do formulário). Inválida = null, nunca quebra a tela. */
export function parseTripPlan(raw: unknown): TripPlan | null {
  const parsed = tripPlanSchema.safeParse(raw);
  return parsed.success ? (parsed.data as TripPlan) : null;
}

export function monthNumberOf(monthValue: string): number | undefined {
  const m = Number(monthValue.split("-")[1]);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined;
}

/** "YYYY-MM" de um ano e mês (1-12). */
export function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "YYYY-MM" que fica `ahead` meses depois do mês de `hoje`. */
export function monthFromToday(hoje: Date, ahead: number): string {
  const total = hoje.getFullYear() * 12 + hoje.getMonth() + ahead;
  return monthValue(Math.floor(total / 12), (total % 12) + 1);
}

/** Quantos meses `monthValue` fica depois do mês de `hoje` (o mês de hoje = 0). */
export function monthsAhead(hoje: Date, value: string): number {
  const [y, m] = value.split("-").map(Number);
  return y * 12 + (m - 1) - (hoje.getFullYear() * 12 + hoje.getMonth());
}

export type TripValues = {
  estimate: TripEstimate | null;
  /** Os 4 blocos como vão para a meta: o que ela trocou, ou a estimativa. */
  fixed: Record<FixedKey, number>;
  /** Outros custos que entram na conta (linha sem nome e sem valor fica de fora). */
  extras: { name: string; value: number }[];
  subtotal: number;
  /** Imprevistos, 10% */
  buffer: number;
  total: number;
  perPerson: number;
};

/**
 * A conta da viagem. Uma só, para a tela, para a meta e para todos os temas.
 *
 * `usaEstimativas` é falso quando a moeda do app não é o real: a base de custos é em reais
 * saindo do Brasil, então os blocos começam zerados e ela digita os dela.
 */
export function tripValues(plan: TripPlan, opts: { usaEstimativas: boolean; month?: number } = { usaEstimativas: true }): TripValues {
  const estimate = estimateTrip({
    legs: plan.legs,
    travelers: plan.travelers,
    style: plan.style,
    month: opts.month ?? monthNumberOf(plan.tripMonth),
  });
  const fixed = {} as Record<FixedKey, number>;
  for (const key of FIXED_KEYS) {
    const edited = plan.overrides[key];
    fixed[key] = edited !== undefined ? clampCategoryValue(edited) : estimate && opts.usaEstimativas ? estimate[key] : 0;
  }
  const extras = plan.extras
    .filter((e) => e.name.trim().length > 0 || e.value > 0)
    .map((e) => ({ name: e.name.trim(), value: clampCategoryValue(e.value) }));
  const { subtotal, buffer, total } = computeTripTotals([...FIXED_KEYS.map((k) => fixed[k]), ...extras.map((e) => e.value)]);
  const travelers = estimate?.travelers ?? Math.max(1, Math.round(plan.travelers) || 1);
  return { estimate, fixed, extras, subtotal, buffer, total, perPerson: Math.round(total / travelers) };
}

/** O total da viagem em outro mês (mesmos valores trocados na mão; só a estimativa muda). */
export function totalInMonth(plan: TripPlan, value: string, usaEstimativas = true): number {
  return tripValues({ ...plan, tripMonth: value }, { usaEstimativas }).total;
}

/** A partir de quantos meses à frente a dica do mês mais barato pode sugerir (seção 3.17). */
export const CHEAPER_MIN_AHEAD = 4;

export type CheaperMonthTip = { monthValue: string; total: number; savings: number };

/**
 * "Em fevereiro de 2027 a mesma viagem sai R$ 2.600 mais barata." Só olha meses a partir de 4 à
 * frente de hoje (dá tempo de juntar; antes a dica sugeria o mês que vem) e só nos 12 meses
 * seguintes a isso. A economia sai só dos blocos ainda estimados: a passagem que ela digitou não
 * fica mais barata porque o mês mudou. Economia pequena (menos de 8% do total) não vira dica.
 */
export function cheaperMonthTip(plan: TripPlan, hoje: Date, usaEstimativas = true): CheaperMonthTip | null {
  if (!usaEstimativas || plan.legs.length === 0) return null;
  const current = totalInMonth(plan, plan.tripMonth);
  if (current <= 0) return null;
  let best: CheaperMonthTip | null = null;
  for (let ahead = CHEAPER_MIN_AHEAD; ahead < CHEAPER_MIN_AHEAD + 12; ahead++) {
    const value = monthFromToday(hoje, ahead);
    if (value === plan.tripMonth) continue;
    const total = totalInMonth(plan, value);
    const savings = current - total;
    if (savings > 0 && (!best || savings > best.savings)) best = { monthValue: value, total, savings };
  }
  if (!best || best.savings < current * 0.08) return null;
  return best;
}

/**
 * Temporada de cada mês (janeiro a dezembro) para o roteiro: a cor do mês no calendário. É o
 * mesmo fator que mexe no total (média dos destinos pesada pelos dias), então mês "alta" é mês
 * em que a viagem sai mais cara de verdade.
 */
export function seasonByMonth(plan: TripPlan): SeasonLevel[] {
  return Array.from({ length: 12 }, (_, i) => {
    const estimate = estimateTrip({ legs: plan.legs, travelers: plan.travelers, style: plan.style, month: i + 1 });
    return estimate ? seasonLevelFor(estimate.seasonFactor) : "media";
  });
}

/**
 * Quanto guardar por mês para ter o total no mês da viagem: a MESMA conta da meta que vai nascer
 * (data-alvo no fim do mês, aporte antecipado, a taxa de meta da pessoa), arredondada para cima.
 */
export function monthlyForTrip(total: number, tripMonth: string, annualRate: number, hoje: Date): number {
  const targetDate = tripGoalTargetDate(tripMonth);
  if (!targetDate || total <= 0) return 0;
  const plan = computeGoalPlan({ targetAmount: total, currentAmount: 0, targetDate, annualRate, now: hoje });
  return Math.ceil(plan.requiredMonthlyContribution);
}

/** Até onde o "Guardando" procura a data de embarque (10 anos). */
const MAX_MONTHS_TO_BOARD = 120;

/**
 * "Guardando R$ X por mês, você embarca em maio de 2027": o primeiro mês em que a meta, com esse
 * aporte, já fecha o total. É a mesma conta da meta (`monthlyForTrip`), só que ao contrário.
 * Null quando nem em 10 anos esse valor chega lá.
 */
export function boardingMonth(total: number, monthly: number, annualRate: number, hoje: Date): string | null {
  if (total <= 0) return monthFromToday(hoje, 1);
  if (monthly <= 0) return null;
  for (let ahead = 1; ahead <= MAX_MONTHS_TO_BOARD; ahead++) {
    const value = monthFromToday(hoje, ahead);
    if (monthlyForTrip(total, value, annualRate, hoje) <= monthly) return value;
  }
  return null;
}

/** O "−" e o "+" do Guardando andam de 100 em 100 (na grade das centenas), nunca abaixo de 100. */
export function stepMonthly(current: number, direction: 1 | -1): number {
  const next = direction > 0 ? Math.floor(current / 100) * 100 + 100 : Math.ceil(current / 100) * 100 - 100;
  return Math.max(100, next);
}

/** "Viagem: Paris" com um destino; "Viagem: Paris e Roma" com dois; "Viagem: Paris +2" acima. */
export function goalNameFor(labels: string[]): string {
  if (labels.length === 1) return `Viagem: ${labels[0]}`;
  if (labels.length === 2) return `Viagem: ${labels[0]} e ${labels[1]}`;
  return `Viagem: ${labels[0]} +${labels.length - 1}`;
}

/** Os 6 passos com pergunta (o 7º é o cartão de embarque). */
export const TRIP_STEPS = ["Para onde?", "Quantos dias em cada lugar?", "Quantas pessoas vão?", "Quando?", "Como você gosta de viajar?", "Confere o custo"] as const;

/** Nomes curtos dos passos, para o "Ajustar" do cartão de embarque. */
export const TRIP_STEP_SHORT = ["Destinos", "Dias", "Pessoas", "Quando", "Estilo", "Custo"] as const;

/** Rótulos do estilo como a pessoa lê (a régua vai de "Mais simples" a "Mais conforto"). */
export const STYLE_LABEL: Record<TravelStyle, string> = {
  economico: "Mais simples",
  medio: "Médio",
  confortavel: "Mais conforto",
};
export const STYLES: TravelStyle[] = ["economico", "medio", "confortavel"];

/**
 * No passo dos dias do tema Padrão (um destino por tela), o "Continuar" anda pelos destinos antes
 * de ir para o próximo passo: devolve o índice do próximo destino, ou null para seguir. Os outros
 * temas mostram todos os destinos numa tela só.
 */
export function proximoDestinoDosDias(passo: number, tema: string, diaDe: number, quantos: number): number | null {
  if (passo !== 2 || tema !== "padrao") return null;
  const atual = Math.min(Math.max(0, diaDe), Math.max(0, quantos - 1));
  return atual < quantos - 1 ? atual + 1 : null;
}
