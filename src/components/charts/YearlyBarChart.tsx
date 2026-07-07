"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Meses futuros (recorrência programada, ainda não realizada) ficam com opacidade reduzida. */
const REALIZED_OPACITY = 1;
const PROJECTED_OPACITY = 0.35;

export function YearlyBarChart({ months }: { months: MonthlyBreakdown[] }) {
  const data = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Renda: m.totalIncome,
    Gastos: m.totalExpense,
    Aportes: m.totalInvestment,
    isRealized: m.isRealized,
  }));

  const hasProjectedMonths = data.some((d) => !d.isRealized);

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
        </BarChart>
      </ResponsiveContainer>
      {hasProjectedMonths && (
        <p className="text-xs text-ink-faint">
          Meses mais claros ainda não aconteceram — são recorrências programadas, não gastos realizados.
        </p>
      )}
    </div>
  );
}
