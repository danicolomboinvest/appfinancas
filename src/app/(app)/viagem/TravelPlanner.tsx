"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plane, BedDouble, UtensilsCrossed, TicketCheck, ShieldQuestion, ArrowRight, Plus, X, MapPin, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { FitText } from "@/components/ui/FitText";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import {
  estimateTrip,
  findCheaperMonth,
  computeTripTotals,
  clampCategoryValue,
  MAX_EXTRA_CATEGORIES,
  TRAVEL_STYLE_LABEL,
  TRIP_LIMITS,
  type TravelDestination,
  type TravelStyle,
} from "@/lib/travel/estimates";
import { DestinationSearch } from "./DestinationSearch";
import { createTravelGoalAction, type TravelGoalState } from "./actions";
import { BulletBar, type BulletRow } from "@/components/charts/BulletBar";
import { useMoney } from "@/components/money/MoneyProvider";
import { useCurrency } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

const initialState: TravelGoalState = {};


/** "YYYY-MM" daqui a seis meses. Com "mês que vem" o app dizia "guardando R$ 9.768/mês você
 * chega lá em 1 mês", que é o oposto de planejar. */
function nextMonthValue(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Número do mês (1-12) de um valor "YYYY-MM". */
function monthNumberOf(monthValue: string): number | undefined {
  const m = Number(monthValue.split("-")[1]);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined;
}

/** Próxima vez que esse mês acontece no futuro, como "YYYY-MM" (pra trocar num toque). */
function nextOccurrenceOf(month: number): string {
  const now = new Date();
  const year = month - 1 > now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Meses inteiros entre hoje e o mês da viagem (mínimo 1, pra dica de poupança mensal). */
function monthsUntil(monthValue: string): number {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return 1;
  const now = new Date();
  return Math.max((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()), 1);
}

type FixedKey = "flights" | "lodging" | "food" | "activities";

// O rótulo de cada bloco vem da voz do tema (`viagemBlocos`); aqui só a ordem e o ícone.
const FIXED_ROWS: { key: FixedKey; icon: typeof Plane }[] = [
  { key: "flights", icon: Plane },
  { key: "lodging", icon: BedDouble },
  { key: "food", icon: UtensilsCrossed },
  { key: "activities", icon: TicketCheck },
];

type Leg = { destination: TravelDestination; days: number };
type ExtraRow = { id: number; name: string; value: number };

const VALUE_INPUT_CLASSES =
  "w-28 shrink-0 rounded-lg border border-border-strong bg-surface py-1 pl-8 pr-2 text-right text-sm tabular-nums text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Input de valor com o "R$" fixo dentro — número solto parecia campo vazio, não dinheiro. */
function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const currency = useCurrency();
  return (
    <span className="relative shrink-0">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">{currencySymbol(currency)}</span>
      <input type="number" inputMode="numeric" min={0} {...props} className={VALUE_INPUT_CLASSES} />
    </span>
  );
}

/**
 * Planejador de viagem: monta um roteiro com VÁRIOS destinos ("3 dias em Paris, 4 em Roma"),
 * busca entre ~220 lugares, estima o custo por trecho e vira meta com aporte mensal. Todos os
 * valores são editáveis e dá pra criar categorias próprias. O cálculo roda aqui pra resposta
 * instantânea; o servidor saneia e recalcula tudo na criação da meta.
 */
export function TravelPlanner() {
  const money = useMoney();
  const { titulos: t } = useProfileTheme().voz;
  const [legs, setLegs] = useState<Leg[]>([]);
  const [travelers, setTravelers] = useState(2);
  const [style, setStyle] = useState<TravelStyle>("medio");
  const [tripMonth, setTripMonth] = useState(nextMonthValue());
  // Edições dos valores fixos, presas à "assinatura" do plano: mudou roteiro/pessoas/estilo, a
  // assinatura muda e as edições antigas deixam de valer (sem useEffect pra resetar).
  const [overrides, setOverrides] = useState<{ sig: string; values: Partial<Record<FixedKey, number>> }>({
    sig: "",
    values: {},
  });
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const extraIdRef = useRef(1);
  const [state, formAction, isPending] = useActionState(createTravelGoalAction, initialState);
  useSuccessToast(isPending, state.error, state.created ? t.viagemMetaCriadaToast : undefined);

  const tripMonthNumber = monthNumberOf(tripMonth);
  const sig = `${legs.map((leg) => `${leg.destination.key}:${leg.days}`).join("|")}#${travelers}#${style}#${tripMonthNumber}`;
  const estimate = useMemo(
    () =>
      estimateTrip({
        legs: legs.map((leg) => ({ destinationKey: leg.destination.key, days: leg.days })),
        travelers,
        style,
        month: tripMonthNumber,
      }),
    [legs, travelers, style, tripMonthNumber],
  );

  // Dica de economia: existe um mês nos próximos 12 que sai bem mais barato?
  const cheaper = useMemo(() => {
    if (!tripMonthNumber || legs.length === 0) return null;
    return findCheaperMonth({
      legs: legs.map((leg) => ({ destinationKey: leg.destination.key, days: leg.days })),
      travelers,
      style,
      month: tripMonthNumber,
    });
  }, [legs, travelers, style, tripMonthNumber]);

  const activeOverrides = overrides.sig === sig ? overrides.values : {};
  const values: Record<FixedKey, number> | null = estimate
    ? {
        flights: activeOverrides.flights ?? estimate.flights,
        lodging: activeOverrides.lodging ?? estimate.lodging,
        food: activeOverrides.food ?? estimate.food,
        activities: activeOverrides.activities ?? estimate.activities,
      }
    : null;

  const totals = values
    ? computeTripTotals([values.flights, values.lodging, values.food, values.activities, ...extras.map((e) => e.value)])
    : null;
  const months = monthsUntil(tripMonth);
  const monthlyHint = totals ? Math.ceil(totals.total / months) : 0;
  const BLOCK_COLORS = ["var(--color-info)", "var(--color-accent)", "var(--color-success)", "var(--color-chart-5)"];
  const tripBullets: BulletRow[] =
    values && totals && totals.total > 0
      ? [
          ...FIXED_ROWS.map(({ key }, i) => ({ key, label: t.viagemBlocos[key], value: values[key], color: BLOCK_COLORS[i] })),
          ...extras.map((e) => ({
            key: `extra-${e.id}`,
            label: e.name || t.viagemExtra,
            value: e.value,
            color: "var(--color-ink-faint)",
          })),
        ]
          .filter((row) => row.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((row) => ({
            key: row.key,
            label: row.label,
            color: row.color,
            fillPercent: (row.value / totals.total) * 100,
            rightLabel: `${money(row.value, { round: true })} · ${Math.round((row.value / totals.total) * 100)}%`,
          }))
      : [];

  const travelersSafe = Math.min(Math.max(travelers || 1, 1), TRIP_LIMITS.maxTravelers);
  const totalDays = legs.reduce((sum, leg) => sum + leg.days, 0);

  function addLeg(destination: TravelDestination) {
    setLegs((prev) =>
      prev.length >= TRIP_LIMITS.maxLegs || prev.some((leg) => leg.destination.key === destination.key)
        ? prev
        : [...prev, { destination, days: prev.length === 0 ? 5 : 3 }],
    );
  }

  function setLegDays(key: string, raw: string) {
    const days = Math.min(Math.max(Math.round(Number(raw)) || 1, TRIP_LIMITS.minDays), TRIP_LIMITS.maxDaysPerLeg);
    setLegs((prev) => prev.map((leg) => (leg.destination.key === key ? { ...leg, days } : leg)));
  }

  function removeLeg(key: string) {
    setLegs((prev) => prev.filter((leg) => leg.destination.key !== key));
  }

  function setFixedValue(key: FixedKey, raw: string) {
    const value = clampCategoryValue(Number(raw));
    setOverrides((prev) => ({ sig, values: { ...(prev.sig === sig ? prev.values : {}), [key]: value } }));
  }

  function addExtra() {
    if (extras.length >= MAX_EXTRA_CATEGORIES) return;
    setExtras((prev) => [...prev, { id: extraIdRef.current++, name: "", value: 0 }]);
  }

  function updateExtra(id: number, patch: Partial<Omit<ExtraRow, "id">>) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeExtra(id: number) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  // Só extras com nome preenchido entram na meta (linha em branco esquecida não polui).
  const validExtras = extras.filter((e) => e.name.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium text-ink-muted">{t.viagemRoteiro}</span>
            {legs.length > 0 && <span className="text-xs text-ink-faint">{t.viagemDiasNoTotal(totalDays)}</span>}
          </div>

          {legs.map((leg, index) => (
            <div key={leg.destination.key} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium tabular-nums text-ink-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{leg.destination.label}</span>
                <span className="block truncate text-xs text-ink-faint">{leg.destination.country}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={TRIP_LIMITS.minDays}
                max={TRIP_LIMITS.maxDaysPerLeg}
                aria-label={`Dias em ${leg.destination.label}`}
                value={leg.days}
                onChange={(e) => setLegDays(leg.destination.key, e.target.value)}
                className="w-14 shrink-0 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="shrink-0 text-xs text-ink-faint">{t.viagemDias(leg.days)}</span>
              <button
                type="button"
                aria-label={`Remover ${leg.destination.label}`}
                onClick={() => removeLeg(leg.destination.key)}
                className="shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}

          {legs.length < TRIP_LIMITS.maxLegs ? (
            <DestinationSearch onPick={addLeg} excludeKeys={legs.map((leg) => leg.destination.key)} />
          ) : (
            <p className="text-xs text-ink-faint">{t.viagemMaxDestinos(TRIP_LIMITS.maxLegs)}</p>
          )}
        </div>

        {legs.length === 0 ? (
          <EmptyState icon={MapPin} message={t.viagemVazio} />
        ) : (
          <>
            <Field
              label={t.viagemQuantasPessoas}
              name="travelers"
              type="number"
              min={TRIP_LIMITS.minTravelers}
              max={TRIP_LIMITS.maxTravelers}
              value={travelers}
              onChange={(e) => setTravelers(Number(e.target.value))}
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-muted">{t.viagemEstilo}</span>
              <div className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
                {(Object.keys(TRAVEL_STYLE_LABEL) as TravelStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`min-w-0 flex-1 truncate rounded-full px-2 py-2 text-sm font-medium transition-all duration-300 ${
                      style === s ? "bg-pill text-on-pill shadow-premium-sm" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t.viagemEstiloLabel(s, TRAVEL_STYLE_LABEL[s])}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <MonthPicker
                label={t.viagemQuando}
                name="tripMonth"
                min={nextMonthValue()}
                value={tripMonth}
                onChange={setTripMonth}
              />

              {/* Temporada: o MESMO lugar custa bem diferente conforme o mês (réveillon na
                  praia, inverno na serra, agosto no Mediterrâneo). */}
              {estimate && estimate.seasonLevel !== "media" && (
                <p
                  className={`rounded-lg px-3 py-2 text-xs ${
                    estimate.seasonLevel === "alta" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
                  }`}
                >
                  {estimate.seasonLevel === "alta" ? (
                    <>
                      <strong>{t.viagemAltaTemporada}</strong> {t.viagemAltaTemporadaDica(Math.round((estimate.seasonFactor - 1) * 100))}
                    </>
                  ) : (
                    <>
                      <strong>{t.viagemBaixaTemporada}</strong> {t.viagemBaixaTemporadaDica(Math.round((1 - estimate.seasonFactor) * 100))}
                    </>
                  )}
                </p>
              )}

              {cheaper && (
                <button
                  type="button"
                  onClick={() => setTripMonth(nextOccurrenceOf(cheaper.month))}
                  className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-surface"
                >
                  <TrendingDown className="size-4 shrink-0 text-success" aria-hidden />
                  {/* O mês e o valor vão em negrito no meio da frase, por isso ela vem em três partes. */}
                  <span className="min-w-0 flex-1 text-xs text-ink">
                    {t.viagemMesMaisBarato[0]}
                    <strong>{MONTH_NAMES[cheaper.month - 1]}</strong>
                    {t.viagemMesMaisBarato[1]}
                    <strong>{money(cheaper.savings, { round: true })}</strong>
                    {t.viagemMesMaisBarato[2]}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-accent-strong">{t.viagemTrocar}</span>
                </button>
              )}
            </div>
          </>
        )}

        {values && totals && estimate && (
          <div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-4">
            <p className="text-xs text-ink-faint">{t.viagemMediaDica}</p>
            {FIXED_ROWS.map(({ key, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label htmlFor={`trip-${key}`} className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                  <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <span className="truncate">{t.viagemBlocos[key]}</span>
                </label>
                <MoneyInput
                  id={`trip-${key}`}
                  value={values[key]}
                  onChange={(e) => setFixedValue(key, e.target.value)}
                />
              </div>
            ))}

            {extras.map((extra) => (
              <div key={extra.id} className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder={t.viagemExtraPlaceholder}
                  value={extra.name}
                  maxLength={40}
                  onChange={(e) => updateExtra(extra.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <MoneyInput
                  aria-label={`Valor de ${extra.name || "categoria extra"}`}
                  value={extra.value}
                  onChange={(e) => updateExtra(extra.id, { value: clampCategoryValue(Number(e.target.value)) })}
                />
                <button
                  type="button"
                  aria-label={`Remover ${extra.name || "categoria extra"}`}
                  onClick={() => removeExtra(extra.id)}
                  className="shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}

            {extras.length < MAX_EXTRA_CATEGORIES && (
              <button
                type="button"
                onClick={addExtra}
                className="flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <Plus className="size-3.5" aria-hidden /> {t.viagemAdicionarCategoria}
              </button>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                <ShieldQuestion className="size-4 shrink-0 text-ink-faint" aria-hidden />
                <span className="truncate">{t.viagemMargem}</span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{money(totals.buffer, { round: true })}</span>
            </div>

            {estimate.legs.length > 1 && (
              <div className="flex flex-col gap-1 border-t border-border pt-2.5">
                <p className="text-xs text-ink-muted">{t.viagemDiariasPorDestino}</p>
                {estimate.legs.map((leg) => (
                  <div key={leg.destination.key} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-ink-faint">
                      {leg.destination.label} · {leg.days} {t.viagemDias(leg.days)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">{money(leg.subtotal, { round: true })}</span>
                  </div>
                ))}
              </div>
            )}

            {/* A tela mais emocional do app era a mais seca: só uma coluna de números. Uma
                barra por bloco mostra, antes de qualquer leitura, o que está puxando o custo
                da viagem — e é o mesmo desenho do orçamento mensal, então não é um gráfico
                novo pra aprender. */}
            {tripBullets.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-3 text-xs text-ink-muted">{t.viagemDeOndeVemCusto}</p>
                <BulletBar rows={tripBullets} />
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-xs text-ink-muted">{t.viagemCustoEstimado}</p>
              <FitText className="text-2xl font-semibold tracking-tight text-ink">{money(totals.total, { round: true })}</FitText>
              <p className="mt-1 text-xs text-ink-faint">
                {t.viagemPorPessoa(money(Math.round(totals.total / travelersSafe)), money(monthlyHint, { round: true }), months)}
              </p>
            </div>
          </div>
        )}

        {/* Roteiro, valores finais e extras viajam como campos do form (listas serializadas). */}
        {values && (
          <>
            <input
              type="hidden"
              name="legs"
              value={JSON.stringify(legs.map((leg) => ({ destinationKey: leg.destination.key, days: leg.days })))}
            />
            <input type="hidden" name="flights" value={values.flights} />
            <input type="hidden" name="lodging" value={values.lodging} />
            <input type="hidden" name="food" value={values.food} />
            <input type="hidden" name="activities" value={values.activities} />
            <input
              type="hidden"
              name="extras"
              value={JSON.stringify(validExtras.map((e) => ({ name: e.name.trim(), value: e.value })))}
            />
          </>
        )}

        {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

        {state.created ? (
          <Link
            href="/planejamento/metas"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm hover:opacity-95"
          >
            {t.viagemVerMeta} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <Button type="submit" disabled={isPending || !totals || totals.total <= 0}>
            {isPending ? t.viagemCriandoMeta : t.viagemCriarMeta}
          </Button>
        )}
      </Card>

      <p className="text-xs text-ink-faint">{t.viagemRodape}</p>
    </div>
  );
}
