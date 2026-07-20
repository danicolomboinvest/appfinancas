"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Meses futuros (recorrência programada, ainda não realizada) ficam com opacidade reduzida. */
const REALIZED_OPACITY = 1;
const PROJECTED_OPACITY = 0.35;

/** Abrevia os valores do eixo Y pra ocupar menos espaço: 120000 → "120k", 1500000 → "1,5mi". */
function abbrevAxis(value: number): string {
  const a = Math.abs(value);
  if (a >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  if (a >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

const SERIES = [
  { key: "Renda", color: CHART_COLORS.success },
  { key: "Gastos", color: CHART_COLORS.danger },
  { key: "Aportes", color: CHART_COLORS.accent },
] as const;

export function YearlyBarChart({
  months,
  plannedByMonth,
}: {
  months: MonthlyBreakdown[];
  /** Total planejado (soma de todas as categorias) por número do mês (1-12) — vem de getAnnualPlannedVsActual. */
  plannedByMonth?: Record<number, number>;
}) {
  const data = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Renda: m.totalIncome,
    Gastos: m.totalExpense,
    Aportes: m.totalInvestment,
    Planejado: plannedByMonth?.[m.month] && plannedByMonth[m.month] > 0 ? plannedByMonth[m.month] : null,
    isRealized: m.isRealized,
  }));

  const hasProjectedMonths = data.some((d) => !d.isRealized);

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={340}>
        {/* barCategoryGap menor + margem esquerda negativa (o eixo estreito devolve o espaço) =
            gráfico maior e mais preenchido, com o eixo ocupando pouco (item 1). */}
        <ComposedChart data={data} barCategoryGap="16%" barGap={2} margin={{ top: 8, right: 6, bottom: 0, left: -14 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`bar-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="name"
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            interval={0}
          />
          <YAxis
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            width={34}
            tickFormatter={abbrevAxis}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} iconType="circle" />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={`url(#bar-${s.key})`} radius={[5, 5, 0, 0]} maxBarSize={26}>
              {data.map((entry, index) => (
                <Cell key={`${s.key}-${index}`} fillOpacity={entry.isRealized ? REALIZED_OPACITY : PROJECTED_OPACITY} />
              ))}
            </Bar>
          ))}
          {plannedByMonth && (
            <Line
              dataKey="Planejado"
              stroke={CHART_COLORS.danger}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {hasProjectedMonths && (
        <p className="text-xs text-ink-faint">
          Meses mais claros ainda não aconteceram — são recorrências programadas, não gastos realizados.
        </p>
      )}
    </div>
  );
}
