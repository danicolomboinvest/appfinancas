"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancingVsRentMonth } from "@/lib/simulators/financing-vs-rent";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

export function FinancingVsRentChart({ schedule }: { schedule: FinancingVsRentMonth[] }) {
  const data = schedule
    .filter((row) => row.month % 6 === 0 || row.month === schedule.length)
    .map((row) => ({
      mes: row.month,
      Financiar: row.financingPatrimony,
      "Alugar + investir": row.investedPatrimony,
    }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="mes"
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          label={{ value: "Mês", position: "insideBottom", offset: -5, fill: CHART_COLORS.axis }}
        />
        <YAxis fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        <Line type="monotone" dataKey="Financiar" stroke={CHART_COLORS.info} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Alugar + investir" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
