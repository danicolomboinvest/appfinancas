"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type FlowBundle = {
  income: number;
  expense: number;
  planned: number;
  investment: number;
  balance: number;
};

type View = "mensal" | "anual";
type Tone = "success" | "danger" | "accent" | "ink";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent-strong",
  ink: "text-ink",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** (renda − gastos) / renda: quanto da renda não virou gasto (ficou de saldo + aportes). */
function savingsRate(b: FlowBundle): number | null {
  if (b.income <= 0) return null;
  return (b.income - b.expense) / b.income;
}

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function IndicatorCard({
  label,
  value,
  tone,
  bar,
  ring,
}: {
  label: string;
  value: string;
  tone: Tone;
  bar?: number;
  /** Quando presente, mostra um anel (gauge) com o valor no centro, em vez de número + barra. */
  ring?: number;
}) {
  if (ring !== undefined) {
    const frac = Math.max(0, Math.min(1, Math.abs(ring)));
    const C = 97.39; // circunferência de r=15.5
    return (
      <Card className="flex flex-col p-3.5 sm:p-4">
        <p className="text-caption text-ink-muted">{label}</p>
        <div className="mt-1.5 flex items-center justify-center">
          <div className="relative h-16 w-16">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-surface-2)" strokeWidth="3.4" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray={`${frac * C} ${C}`}
              />
            </svg>
            <span
              className={`absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}
            >
              {value}
            </span>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-3.5 sm:p-4">
      <p className="text-caption text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-indicator font-semibold tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${bar >= 0 ? "bg-success" : "bg-danger"}`}
            style={{ width: `${Math.min(100, Math.max(0, Math.abs(bar) * 100))}%` }}
          />
        </div>
      )}
    </Card>
  );
}

/**
 * Cabeçalho do Fluxo (item 2 da Rodada 2): 6 indicadores em cards (número grande, rótulo pequeno),
 * seletor de período e alternância Mensal/Anual. O toggle é estado local (troca instantânea); os
 * dois conjuntos de dados já vêm calculados do servidor, então não há ida-e-volta ao trocar. As
 * setas ‹ › navegam por mês (ou ano, no modo anual) via Link, carregando ?view pra manter o modo.
 */
export type Pacing = {
  /** Fração do orçamento do mês já gasta (0–1+). */
  budgetUsed: number;
  /** Fração do mês já decorrida (0–1). */
  monthElapsed: number;
};

export function FlowIndicators({
  year,
  month,
  initialView,
  monthly,
  annual,
  pacing,
}: {
  year: number;
  month: number;
  initialView: View;
  monthly: FlowBundle;
  annual: FlowBundle;
  /** Ritmo do mês (orçamento consumido vs. mês decorrido) — só no mês corrente com orçamento. */
  pacing?: Pacing | null;
}) {
  const [view, setView] = useState<View>(initialView);
  const bundle = view === "mensal" ? monthly : annual;
  const rate = savingsRate(bundle);

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);
  const periodLabel = view === "mensal" ? `${MONTH_LABELS[month - 1]} de ${year}` : String(year);

  // Setas: no modo mensal andam mês a mês; no anual, ano a ano (12 meses). Mantêm ?view.
  const prevHref =
    view === "mensal"
      ? `/mensal/${prev.year}/${prev.month}?view=mensal`
      : `/mensal/${year - 1}/${month}?view=anual`;
  const nextHref =
    view === "mensal"
      ? `/mensal/${next.year}/${next.month}?view=mensal`
      : `/mensal/${year + 1}/${month}?view=anual`;
  const prevArrowLabel = view === "mensal" ? MONTH_SHORT[prev.month - 1] : String(year - 1);
  const nextArrowLabel = view === "mensal" ? MONTH_SHORT[next.month - 1] : String(year + 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {/* Seletor de período */}
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label={`Anterior: ${prevArrowLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="min-w-[7.5rem] text-center text-sm font-medium text-ink">{periodLabel}</span>
          <Link
            href={nextHref}
            aria-label={`Próximo: ${nextArrowLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Toggle Mensal / Anual (segmented control) */}
        <div className="flex items-center rounded-full border border-border bg-surface-2 p-0.5">
          {(["mensal", "anual"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <IndicatorCard label="Renda" value={formatBRL(bundle.income)} tone="success" />
        <IndicatorCard label="Gastos" value={formatBRL(bundle.expense)} tone="danger" />
        <IndicatorCard label="Planejamento" value={formatBRL(bundle.planned)} tone="ink" />
        <IndicatorCard label="Aportes" value={formatBRL(bundle.investment)} tone="accent" />
        <IndicatorCard label="Saldo" value={formatBRL(bundle.balance)} tone={bundle.balance >= 0 ? "accent" : "danger"} />
        <IndicatorCard
          label="Taxa de poupança"
          value={rate === null ? "—" : `${Math.round(rate * 100)}%`}
          tone={rate !== null && rate >= 0 ? "success" : "danger"}
          ring={rate ?? undefined}
        />
      </div>

      {/* Ritmo do mês: gastou mais rápido que o mês passou? Duas barras comparáveis. */}
      {view === "mensal" && pacing && (
        <Card className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-caption font-medium text-ink-muted">Ritmo do mês</p>
            <p
              className={`text-caption font-semibold ${
                pacing.budgetUsed > pacing.monthElapsed + 0.05
                  ? "text-danger"
                  : pacing.budgetUsed > pacing.monthElapsed
                    ? "text-accent-strong"
                    : "text-success"
              }`}
            >
              {pacing.budgetUsed > pacing.monthElapsed + 0.05
                ? "Gastando rápido demais"
                : pacing.budgetUsed > pacing.monthElapsed
                  ? "No limite do ritmo"
                  : "Dentro do ritmo"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-caption text-ink-faint">Orçamento</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${pacing.budgetUsed > pacing.monthElapsed ? "bg-danger" : "bg-success"}`}
                  style={{ width: `${Math.min(100, pacing.budgetUsed * 100)}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-caption tabular-nums text-ink">
                {Math.round(pacing.budgetUsed * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-caption text-ink-faint">Mês</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-ink-faint"
                  style={{ width: `${Math.min(100, pacing.monthElapsed * 100)}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-caption tabular-nums text-ink">
                {Math.round(pacing.monthElapsed * 100)}%
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
