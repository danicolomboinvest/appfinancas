"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectionYear } from "@/lib/consolidation/projection";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";

export function PatrimonyProjectionChart({
  years,
  nomes = { nominal: "Patrimônio (nominal)", real: "Patrimônio (real)" },
}: {
  years: ProjectionYear[];
  /** Os nomes das duas linhas, na voz do tema. */
  nomes?: { nominal: string; real: string };
}) {
  const money = useMoney();
  const data = years.map((y) => ({
    idade: y.age,
    [nomes.nominal]: y.balanceNominal,
    [nomes.real]: y.balanceReal,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="idade"
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          label={{ value: "Idade", position: "insideBottom", offset: -5, fill: CHART_COLORS.axis }}
        />
        <YAxis
          fontSize={12}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value) => money(Number(value), { compact: true })}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => money(Number(value))}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        <Line type="monotone" dataKey={nomes.nominal} stroke={CHART_COLORS.info} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey={nomes.real} stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
