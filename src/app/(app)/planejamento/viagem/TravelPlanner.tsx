"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Plane, BedDouble, UtensilsCrossed, TicketCheck, ShieldQuestion, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { FitText } from "@/components/ui/FitText";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import {
  estimateTrip,
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

const BREAKDOWN_ROWS = [
  { key: "flights", label: "Passagens", icon: Plane },
  { key: "lodging", label: "Hospedagem", icon: BedDouble },
  { key: "food", label: "Alimentação", icon: UtensilsCrossed },
  { key: "activities", label: "Passeios e transporte", icon: TicketCheck },
  { key: "buffer", label: "Margem de imprevistos (10%)", icon: ShieldQuestion },
] as const;

/**
 * Planejador de viagem (v1): estimativa curada por destino/estilo → orçamento por categoria →
 * vira meta "Viagem: X" com um toque. O cálculo roda aqui no cliente pra resposta instantânea
 * a cada ajuste; na criação da meta o servidor RECALCULA com os mesmos inputs (não confia no
 * total do cliente).
 */
export function TravelPlanner() {
  const [destinationKey, setDestinationKey] = useState(TRAVEL_DESTINATIONS[0].key);
  const [days, setDays] = useState(7);
  const [travelers, setTravelers] = useState(2);
  const [style, setStyle] = useState<TravelStyle>("medio");
  const [tripMonth, setTripMonth] = useState(nextMonthValue());
  const [state, formAction, isPending] = useActionState(createTravelGoalAction, initialState);
  useSuccessToast(isPending, state.error, state.created ? "Meta da viagem criada! Veja em Metas." : undefined);

  const estimate = useMemo(
    () => estimateTrip({ destinationKey, days, travelers, style }),
    [destinationKey, days, travelers, style],
  );
  const months = monthsUntil(tripMonth);
  const monthlyHint = estimate ? Math.ceil(estimate.total / months) : 0;

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
          <input type="hidden" name="style" value={style} />
        </div>

        <Field
          label="Quando pretende ir?"
          name="tripMonth"
          type="month"
          min={nextMonthValue()}
          value={tripMonth}
          onChange={(e) => setTripMonth(e.target.value)}
        />

        {estimate && (
          <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4">
            {BREAKDOWN_ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
                  <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatBRL(estimate[key])}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-border pt-3">
              <p className="text-xs text-ink-muted">Custo estimado da viagem</p>
              <FitText className="text-2xl font-semibold tracking-tight text-ink">{formatBRL(estimate.total)}</FitText>
              <p className="mt-1 text-xs text-ink-faint">
                {formatBRL(estimate.perPerson)} por pessoa · guardando {formatBRL(monthlyHint)}/mês, você chega lá em{" "}
                {months} {months === 1 ? "mês" : "meses"}.
              </p>
            </div>
          </div>
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
          <Button type="submit" disabled={isPending || !estimate}>
            {isPending ? "Criando meta..." : "Criar meta desta viagem"}
          </Button>
        )}
      </Card>

      <p className="text-xs text-ink-faint">
        Estimativas médias para planejamento (valores de 2026, saindo de capital brasileira) — não são cotação. Ajuste a
        meta depois se o seu orçamento for diferente.
      </p>
    </div>
  );
}
