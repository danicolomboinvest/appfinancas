"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPlannedVsActual } from "@/lib/planning/budget-comparison";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PlannedVsActualLineChart({ months }: { months: MonthlyPlannedVsActual[] }) {
  const data = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Planejado: m.totalPlanned,
    // Meses futuros ainda não têm "realizado" — a linha só desenha até o mês corrente.
    Realizado: m.isRealized ? m.totalSpent : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        <Line type="monotone" dataKey="Planejado" stroke={CHART_COLORS.info} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="Realizado" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
