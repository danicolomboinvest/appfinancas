"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plane, BedDouble, UtensilsCrossed, TicketCheck, ShieldQuestion, ArrowRight, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { FitText } from "@/components/ui/FitText";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import {
  estimateTrip,
  computeTripTotals,
  clampCategoryValue,
  MAX_EXTRA_CATEGORIES,
  TRAVEL_DESTINATIONS,
  TRAVEL_STYLE_LABEL,
  TRIP_LIMITS,
  type TravelStyle,
} from "@/lib/travel/estimates";
import { createTravelGoalAction, type TravelGoalState } from "./actions";

const initialState: TravelGoalState = {};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** "YYYY-MM" do mês que vem — viagem é sempre no futuro. */
function nextMonthValue(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

/** Meses inteiros entre hoje e o mês da viagem (mínimo 1, pra dica de poupança mensal). */
function monthsUntil(monthValue: string): number {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return 1;
  const now = new Date();
  return Math.max((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()), 1);
}

const REGIONS = ["Brasil", "América do Sul", "América do Norte", "Europa", "Ásia e outros"] as const;

type FixedKey = "flights" | "lodging" | "food" | "activities";

const FIXED_ROWS: { key: FixedKey; label: string; icon: typeof Plane }[] = [
  { key: "flights", label: "Passagens", icon: Plane },
  { key: "lodging", label: "Hospedagem", icon: BedDouble },
  { key: "food", label: "Alimentação", icon: UtensilsCrossed },
  { key: "activities", label: "Passeios e transporte", icon: TicketCheck },
];

type ExtraRow = { id: number; name: string; value: number };

const VALUE_INPUT_CLASSES =
  "w-24 shrink-0 rounded-lg border border-border-strong bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Planejador de viagem: estimativa curada por destino/estilo preenche o orçamento, e a pessoa
 * pode EDITAR cada valor e CRIAR categorias próprias (compras, seguro, chip...) antes de virar
 * meta. Trocar destino/dias/pessoas/estilo re-estima os 4 valores fixos (edições são descartadas
 * — a assinatura do plano mudou); as categorias extras são da pessoa e ficam. O servidor saneia
 * e recalcula tudo na criação da meta.
 */
export function TravelPlanner() {
  const [destinationKey, setDestinationKey] = useState(TRAVEL_DESTINATIONS[0].key);
  const [days, setDays] = useState(7);
  const [travelers, setTravelers] = useState(2);
  const [style, setStyle] = useState<TravelStyle>("medio");
  const [tripMonth, setTripMonth] = useState(nextMonthValue());
  // Edições dos 4 valores fixos, presas à "assinatura" do plano: mudou destino/dias/pessoas/
  // estilo, a assinatura muda e as edições antigas deixam de valer (sem useEffect pra resetar).
  const [overrides, setOverrides] = useState<{ sig: string; values: Partial<Record<FixedKey, number>> }>({
    sig: "",
    values: {},
  });
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const extraIdRef = useRef(1);
  const [state, formAction, isPending] = useActionState(createTravelGoalAction, initialState);
  useSuccessToast(isPending, state.error, state.created ? "Meta da viagem criada! Veja em Metas." : undefined);

  const sig = `${destinationKey}|${days}|${travelers}|${style}`;
  const estimate = useMemo(
    () => estimateTrip({ destinationKey, days, travelers, style }),
    [destinationKey, days, travelers, style],
  );

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
  const travelersSafe = Math.min(Math.max(travelers || 1, 1), TRIP_LIMITS.maxTravelers);

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
      <Card as="form" action={formAction} className="flex flex-col gap-4 p-5">
        <SelectField
          label="Para onde?"
          name="destinationKey"
          value={destinationKey}
          onChange={(e) => setDestinationKey(e.target.value)}
        >
          {REGIONS.map((region) => (
            <optgroup key={region} label={region}>
              {TRAVEL_DESTINATIONS.filter((d) => d.region === region).map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Quantos dias?"
            name="days"
            type="number"
            min={TRIP_LIMITS.minDays}
            max={TRIP_LIMITS.maxDays}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          <Field
            label="Quantas pessoas?"
            name="travelers"
            type="number"
            min={TRIP_LIMITS.minTravelers}
            max={TRIP_LIMITS.maxTravelers}
            value={travelers}
            onChange={(e) => setTravelers(Number(e.target.value))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Estilo da viagem</span>
          <div className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
            {(Object.keys(TRAVEL_STYLE_LABEL) as TravelStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={`min-w-0 flex-1 truncate rounded-full px-2 py-2 text-sm font-medium transition-all duration-300 ${
                  style === s ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                {TRAVEL_STYLE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Quando pretende ir?"
          name="tripMonth"
          type="month"
          min={nextMonthValue()}
          value={tripMonth}
          onChange={(e) => setTripMonth(e.target.value)}
        />

        {values && totals && (
          <div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-4">
            <p className="text-xs text-ink-faint">Toque num valor para ajustar ao seu orçamento.</p>
            {FIXED_ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label htmlFor={`trip-${key}`} className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                  <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <span className="truncate">{label}</span>
                </label>
                <input
                  id={`trip-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={values[key]}
                  onChange={(e) => setFixedValue(key, e.target.value)}
                  className={VALUE_INPUT_CLASSES}
                />
              </div>
            ))}

            {extras.map((extra) => (
              <div key={extra.id} className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Ex.: compras, seguro..."
                  value={extra.name}
                  maxLength={40}
                  onChange={(e) => updateExtra(extra.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Valor de ${extra.name || "categoria extra"}`}
                  value={extra.value}
                  onChange={(e) => updateExtra(extra.id, { value: clampCategoryValue(Number(e.target.value)) })}
                  className={VALUE_INPUT_CLASSES}
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
                <Plus className="size-3.5" aria-hidden /> Adicionar categoria
              </button>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                <ShieldQuestion className="size-4 shrink-0 text-ink-faint" aria-hidden />
                <span className="truncate">Margem de imprevistos (10%)</span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatBRL(totals.buffer)}</span>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-ink-muted">Custo estimado da viagem</p>
              <FitText className="text-2xl font-semibold tracking-tight text-ink">{formatBRL(totals.total)}</FitText>
              <p className="mt-1 text-xs text-ink-faint">
                {formatBRL(Math.round(totals.total / travelersSafe))} por pessoa · guardando {formatBRL(monthlyHint)}/mês,
                você chega lá em {months} {months === 1 ? "mês" : "meses"}.
              </p>
            </div>
          </div>
        )}

        {/* Valores finais viajam como campos do form; extras (lista dinâmica) vão serializadas. */}
        {values && (
          <>
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
            Ver minha meta em Metas <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <Button type="submit" disabled={isPending || !totals || totals.total <= 0}>
            {isPending ? "Criando meta..." : "Criar meta desta viagem"}
          </Button>
        )}
      </Card>

      <p className="text-xs text-ink-faint">
        Estimativas médias para planejamento (valores de 2026, saindo de capital brasileira) — não são cotação. Ajuste
        os valores acima ao seu orçamento; trocar destino, dias, pessoas ou estilo re-estima os valores fixos.
      </p>
    </div>
  );
}
