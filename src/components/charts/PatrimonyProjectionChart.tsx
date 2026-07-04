"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectionYear } from "@/lib/consolidation/projection";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

export function PatrimonyProjectionChart({ years }: { years: ProjectionYear[] }) {
  const data = years.map((y) => ({
    idade: y.age,
    "Patrimônio (nominal)": y.balanceNominal,
    "Patrimônio (real)": y.balanceReal,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="idade"
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          label={{ value: "Idade", position: "insideBottom", offset: -5, fill: CHART_COLORS.axis }}
        />
        <YAxis fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        <Line type="monotone" dataKey="Patrimônio (nominal)" stroke={CHART_COLORS.info} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="Patrimônio (real)" stroke={CHART_COLORS.gold} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
