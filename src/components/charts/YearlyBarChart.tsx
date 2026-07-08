"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Meses futuros (recorrência programada, ainda não realizada) ficam com opacidade reduzida. */
const REALIZED_OPACITY = 1;
const PROJECTED_OPACITY = 0.35;

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
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
          <Bar dataKey="Renda" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`renda-${index}`} fillOpacity={entry.isRealized ? REALIZED_OPACITY : PROJECTED_OPACITY} />
            ))}
          </Bar>
          <Bar dataKey="Gastos" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`gastos-${index}`} fillOpacity={entry.isRealized ? REALIZED_OPACITY : PROJECTED_OPACITY} />
            ))}
          </Bar>
          <Bar dataKey="Aportes" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`aportes-${index}`} fillOpacity={entry.isRealized ? REALIZED_OPACITY : PROJECTED_OPACITY} />
            ))}
          </Bar>
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
