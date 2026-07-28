/**
 * Planejador de viagem (v1): estimativas de custo CURADAS, mantidas aqui no código — de
 * propósito, sem raspar site externo (sites de custo de viagem proíbem raspagem nos termos ou
 * mudam sem aviso; uma base própria nunca "quebra" e é fácil de ajustar). Valores em R$ de
 * 2026, pensados pra uma referência de planejamento, não orçamento fechado — a pessoa ajusta
 * o resultado antes de virar meta.
 *
 * Convenções dos valores por destino (estilo "médio"):
 *  - flightPerPerson: passagem ida+volta por pessoa, saindo de capital brasileira.
 *  - lodgingPerNight: diária de UM quarto (casal ou 2 camas). Quartos = teto de pessoas/2.
 *  - foodPerPersonDay / activitiesPerPersonDay: por pessoa por dia (passeios incluem ingressos
 *    e transporte local).
 */

export type TravelStyle = "economico" | "medio" | "confortavel";

export type TravelDestination = {
  key: string;
  label: string;
  region: "Brasil" | "América do Sul" | "América do Norte" | "Europa" | "Ásia e outros";
  flightPerPerson: number;
  lodgingPerNight: number;
  foodPerPersonDay: number;
  activitiesPerPersonDay: number;
};

export const TRAVEL_STYLE_LABEL: Record<TravelStyle, string> = {
  economico: "Econômico",
  medio: "Médio",
  confortavel: "Confortável",
};

/** Passagem varia menos entre estilos (tarifa é tarifa); hospedagem/comida/passeios variam mais. */
const STYLE_MULTIPLIER: Record<TravelStyle, { flight: number; daily: number }> = {
  economico: { flight: 0.85, daily: 0.65 },
  medio: { flight: 1, daily: 1 },
  confortavel: { flight: 1.5, daily: 1.7 },
};

export const TRAVEL_DESTINATIONS: TravelDestination[] = [
  // Brasil
  { key: "gramado", label: "Gramado e Serra Gaúcha", region: "Brasil", flightPerPerson: 900, lodgingPerNight: 380, foodPerPersonDay: 150, activitiesPerPersonDay: 120 },
  { key: "rio", label: "Rio de Janeiro", region: "Brasil", flightPerPerson: 700, lodgingPerNight: 420, foodPerPersonDay: 160, activitiesPerPersonDay: 90 },
  { key: "porto-galinhas", label: "Porto de Galinhas / Litoral NE", region: "Brasil", flightPerPerson: 1000, lodgingPerNight: 450, foodPerPersonDay: 150, activitiesPerPersonDay: 110 },
  { key: "noronha", label: "Fernando de Noronha", region: "Brasil", flightPerPerson: 2300, lodgingPerNight: 800, foodPerPersonDay: 250, activitiesPerPersonDay: 260 },
  { key: "chapada", label: "Chapada (Veadeiros/Diamantina)", region: "Brasil", flightPerPerson: 900, lodgingPerNight: 300, foodPerPersonDay: 120, activitiesPerPersonDay: 130 },
  // América do Sul
  { key: "buenos-aires", label: "Buenos Aires", region: "América do Sul", flightPerPerson: 1800, lodgingPerNight: 380, foodPerPersonDay: 140, activitiesPerPersonDay: 90 },
  { key: "santiago", label: "Santiago e Chile", region: "América do Sul", flightPerPerson: 2000, lodgingPerNight: 420, foodPerPersonDay: 150, activitiesPerPersonDay: 120 },
  { key: "machu-picchu", label: "Cusco e Machu Picchu", region: "América do Sul", flightPerPerson: 2500, lodgingPerNight: 320, foodPerPersonDay: 120, activitiesPerPersonDay: 260 },
  // América do Norte
  { key: "cancun", label: "Cancún", region: "América do Norte", flightPerPerson: 3500, lodgingPerNight: 750, foodPerPersonDay: 260, activitiesPerPersonDay: 200 },
  { key: "orlando", label: "Orlando (parques)", region: "América do Norte", flightPerPerson: 3800, lodgingPerNight: 650, foodPerPersonDay: 260, activitiesPerPersonDay: 380 },
  { key: "nova-york", label: "Nova York", region: "América do Norte", flightPerPerson: 4000, lodgingPerNight: 950, foodPerPersonDay: 300, activitiesPerPersonDay: 160 },
  // Europa
  { key: "lisboa", label: "Lisboa e Portugal", region: "Europa", flightPerPerson: 4300, lodgingPerNight: 550, foodPerPersonDay: 210, activitiesPerPersonDay: 110 },
  { key: "paris", label: "Paris", region: "Europa", flightPerPerson: 4800, lodgingPerNight: 750, foodPerPersonDay: 260, activitiesPerPersonDay: 160 },
  { key: "roma", label: "Roma e Itália", region: "Europa", flightPerPerson: 4800, lodgingPerNight: 650, foodPerPersonDay: 240, activitiesPerPersonDay: 140 },
  // Ásia e outros
  { key: "toquio", label: "Tóquio e Japão", region: "Ásia e outros", flightPerPerson: 7000, lodgingPerNight: 620, foodPerPersonDay: 200, activitiesPerPersonDay: 160 },
];

export function findDestination(key: string): TravelDestination | null {
  return TRAVEL_DESTINATIONS.find((d) => d.key === key) ?? null;
}

export type TripInput = {
  destinationKey: string;
  days: number;
  travelers: number;
  style: TravelStyle;
};

export type TripEstimate = {
  destination: TravelDestination;
  days: number;
  travelers: number;
  style: TravelStyle;
  flights: number;
  lodging: number;
  food: number;
  activities: number;
  /** Margem de imprevistos (10% do subtotal) — câmbio, bagagem, aquele passeio extra. */
  buffer: number;
  total: number;
  perPerson: number;
};

/** Faixas sãs pros inputs (o cliente também limita, aqui é a garantia). */
export const TRIP_LIMITS = { minDays: 2, maxDays: 60, minTravelers: 1, maxTravelers: 10 } as const;

/** Teto por categoria quando a pessoa edita os valores na mão (contra dedo a mais em zero). */
export const MAX_CATEGORY_VALUE = 1_000_000;

/** Máximo de categorias extras criadas pela pessoa (compras, seguro, chip...). */
export const MAX_EXTRA_CATEGORIES = 10;

/** Valor editado pela pessoa, saneado: inteiro, nunca negativo, nunca absurdo, NaN vira 0. */
export function clampCategoryValue(value: number): number {
  return Math.min(Math.max(Math.round(value) || 0, 0), MAX_CATEGORY_VALUE);
}

/**
 * Margem de imprevistos (10%) e total a partir dos valores por categoria — as 4 fixas e as
 * extras criadas pela pessoa. Usado tanto pro cálculo estimado quanto pros valores EDITADOS
 * (a margem sempre acompanha o que estiver na lista).
 */
export function computeTripTotals(values: number[]): { subtotal: number; buffer: number; total: number } {
  const subtotal = values.reduce((sum, v) => sum + clampCategoryValue(v), 0);
  const buffer = Math.round(subtotal * 0.1);
  return { subtotal, buffer, total: subtotal + buffer };
}

export function estimateTrip(input: TripInput): TripEstimate | null {
  const destination = findDestination(input.destinationKey);
  if (!destination) return null;
  const days = Math.min(Math.max(Math.round(input.days), TRIP_LIMITS.minDays), TRIP_LIMITS.maxDays);
  const travelers = Math.min(Math.max(Math.round(input.travelers), TRIP_LIMITS.minTravelers), TRIP_LIMITS.maxTravelers);
  const mult = STYLE_MULTIPLIER[input.style] ?? STYLE_MULTIPLIER.medio;

  const nights = Math.max(days - 1, 1);
  const rooms = Math.ceil(travelers / 2);

  const flights = Math.round(destination.flightPerPerson * travelers * mult.flight);
  const lodging = Math.round(destination.lodgingPerNight * nights * rooms * mult.daily);
  const food = Math.round(destination.foodPerPersonDay * days * travelers * mult.daily);
  const activities = Math.round(destination.activitiesPerPersonDay * days * travelers * mult.daily);
  const subtotal = flights + lodging + food + activities;
  const buffer = Math.round(subtotal * 0.1);
  const total = subtotal + buffer;

  return {
    destination,
    days,
    travelers,
    style: input.style,
    flights,
    lodging,
    food,
    activities,
    buffer,
    total,
    perPerson: Math.round(total / travelers),
  };
}
