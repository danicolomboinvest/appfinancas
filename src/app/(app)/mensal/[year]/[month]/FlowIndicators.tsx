"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { FitText } from "@/components/ui/FitText";

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


/** (renda − gastos) / renda: quanto da renda não virou gasto (ficou de saldo + aportes). */
function savingsRate(b: FlowBundle): number | null {
  if (b.income <= 0) return null;
  return (b.income - b.expense) / b.income;
}

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}



/**
 * Uma parcela da conta do mês. Muda de forma conforme a tela, com o MESMO conteúdo:
 *
 * - No celular é uma LINHA (rótulo à esquerda, valor à direita) e a conta se lê de cima
 *   pra baixo.
 * - No computador vira uma CÉLULA (rótulo pequeno em cima, número grande embaixo) e a
 *   conta se lê da esquerda pra direita, com os sinais entre as células.
 *
 * A linha esticada num monitor deixava meio palmo de vazio entre "Entrou" e o número —
 * o olho tinha que atravessar a tela para ligar as duas coisas. Já a grade solta de
 * números, que existia antes, escondia a conta. A equação resolve os dois: usa a largura
 * e continua mostrando que Entrou − Gastou − Aportou = Resultado.
 */
function SummaryCell({
  label,
  value,
  sign,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  sign?: "+" | "−";
  tone: Tone;
  /** O resultado: fundo levemente tingido e ponto colorido ao lado do rótulo, pra fechar a conta. */
  emphasis?: boolean;
}) {
  const dot = emphasis && (
    <span
      className="size-2 rounded-full"
      style={{ backgroundColor: tone === "success" ? "var(--color-success)" : "var(--color-danger)" }}
    />
  );
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3.5 lg:flex-col lg:items-start lg:justify-center lg:gap-1.5 lg:px-5 lg:py-5 ${
        emphasis ? "bg-surface-2" : "border-b border-border lg:border-b-0"
      }`}
    >
      <span className={`flex items-center gap-2 text-[16px] text-ink lg:text-[14px] lg:font-medium lg:text-ink-muted ${emphasis ? "font-semibold" : ""}`}>
        {label}
        {dot}
      </span>
      {/* Celular: sinal discreto colado no número, porque é ele que diz se a parcela soma ou
          subtrai. Computador: sem sinal e sem operador entre as células — os rótulos já dizem
          o que cada número é, e "− − =" no meio ficava feio. O número encolhe pra caber na
          célula (FitText) em vez de quebrar "R$" numa linha e o valor na outra. */}
      <span className={`whitespace-nowrap text-[17px] font-semibold tabular-nums tracking-tight lg:hidden ${TONE_TEXT[tone]}`}>
        {sign && <span className="mr-0.5 text-[14px] font-medium text-ink-faint">{sign}</span>}
        {value}
      </span>
      <div className="hidden w-full lg:block">
        <FitText className={`text-[20px] font-semibold tabular-nums tracking-tight xl:text-[24px] 2xl:text-[28px] ${TONE_TEXT[tone]}`}>{value}</FitText>
      </div>
    </div>
  );
}

function SecondaryStat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="px-2 py-1 text-center first:pl-0 last:pr-0">
      <p className="text-caption text-ink-muted lg:text-[13px]">{label}</p>
      <p className={`mt-0.5 text-[16px] font-semibold tabular-nums lg:text-[20px] ${TONE_TEXT[tone]}`}>{value}</p>
    </div>
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
  /** Ritmo do mês (orçamento consumido vs. mês decorrido), só no mês corrente com orçamento. */
  pacing?: Pacing | null;
}) {
  const money = useMoney();
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

      {/* Entrou / Saiu / Resultado num bloco só, em linhas — e não seis números soltos numa
          grade. A grade obrigava a pessoa a descobrir sozinha que Renda menos Gastos dá o
          Saldo; em linhas, com o resultado destacado no fim, a conta se lê de cima pra baixo.
          As DUAS saídas (gastos e aportes) ficam aqui dentro, senão a soma da tela não fecha.
          Planejamento e poupança são contexto e ficam abaixo, menores. */}
      <div className="overflow-hidden rounded-2xl border border-border lg:grid lg:grid-cols-4 lg:items-stretch lg:divide-x lg:divide-border">
        <SummaryCell label="Entrou" value={money(bundle.income)} sign="+" tone="success" />
        <SummaryCell label="Gastou" value={money(bundle.expense)} sign="−" tone="danger" />
        {/* Aportar também TIRA dinheiro do mês. Sem esta parcela a conta da tela não fechava:
            "entrou 12, saiu 8" e um resultado de −7 que só se explicava por um número que
            estava noutro lugar da página. Dinheiro que sai fica junto do dinheiro que sai. */}
        <SummaryCell label="Aportou" value={money(bundle.investment)} sign="−" tone="accent" />
        <SummaryCell
          label="Resultado"
          value={money(bundle.balance)}
          tone={bundle.balance >= 0 ? "success" : "danger"}
          emphasis
        />
      </div>

      {/* No computador, os números de contexto e o ritmo do mês dividem a mesma faixa: sozinhos,
          cada um esticava por um monitor inteiro pra dizer duas palavras. */}
      <div
        className={
          view === "mensal" && pacing
            ? "flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:items-center lg:gap-8"
            : "flex flex-col gap-4"
        }
      >
        <div className="grid grid-cols-2 divide-x divide-border">
          <SecondaryStat label="Planejamento" value={money(bundle.planned)} tone="ink" />
          <SecondaryStat
            label="Poupança"
            value={rate === null ? "—" : `${Math.round(rate * 100)}%`}
            tone={rate !== null && rate >= 0 ? "success" : "danger"}
          />
        </div>

      {/* Ritmo do mês: gastou mais rápido que o mês passou? Duas barras comparáveis. */}
      {view === "mensal" && pacing && (
        <div className="flex flex-col gap-2.5 border-t border-border pt-5 lg:border-t-0 lg:pt-0">
          <div className="flex items-center justify-between">
            <p className="text-caption font-medium text-ink-muted lg:text-[13px]">Ritmo do mês</p>
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
              <span className="w-20 shrink-0 text-caption text-ink-faint lg:text-[13px]">Orçamento</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${pacing.budgetUsed > pacing.monthElapsed ? "bg-danger" : "bg-success"}`}
                  style={{ width: `${Math.min(100, pacing.budgetUsed * 100)}%` }}
                />
              </div>
              <span className="min-w-10 shrink-0 whitespace-nowrap text-right text-caption tabular-nums text-ink lg:text-[13px]">
                {Math.round(pacing.budgetUsed * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-caption text-ink-faint lg:text-[13px]">Mês</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-ink-faint"
                  style={{ width: `${Math.min(100, pacing.monthElapsed * 100)}%` }}
                />
              </div>
              <span className="min-w-10 shrink-0 whitespace-nowrap text-right text-caption tabular-nums text-ink lg:text-[13px]">
                {Math.round(pacing.monthElapsed * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
