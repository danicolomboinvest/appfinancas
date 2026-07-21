"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { formatCompactBRL } from "@/lib/format";

export function SavingsProjectionChart({
  projection,
  targetAmount,
}: {
  projection: { month: number; balance: number }[];
  targetAmount: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={projection} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
        <defs>
          {/* Gradiente sob a linha (documento de referência de design) — antes era opacidade fixa. */}
          <linearGradient id="savings-projection-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="month"
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          label={{ value: "Mês", position: "insideBottom", offset: -5, fill: CHART_COLORS.axis }}
        />
        <YAxis
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value) => formatCompactBRL(Number(value))}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <ReferenceLine y={targetAmount} stroke={CHART_COLORS.danger} strokeDasharray="4 4" label={{ value: "Meta", fill: CHART_COLORS.danger, fontSize: 12 }} />
        <Area type="monotone" dataKey="balance" stroke={CHART_COLORS.accent} fill="url(#savings-projection-fill)" name="Saldo" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
