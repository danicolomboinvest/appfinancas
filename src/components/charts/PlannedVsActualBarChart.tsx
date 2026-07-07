"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPlannedVsActual } from "@/lib/planning/budget-comparison";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PlannedVsActualBarChart({ months }: { months: MonthlyPlannedVsActual[] }) {
  const data = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Planejado: m.totalPlanned,
    // Meses futuros ainda não têm "realizado" — null faz o Recharts pular a barra em vez de
    // mostrar um enganoso "R$ 0,00 gasto".
    Realizado: m.isRealized ? m.totalSpent : null,
  }));

  return (
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
        <Bar dataKey="Planejado" fill={CHART_COLORS.info} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Realizado" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
