"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

export type ScoreHistoryPoint = { date: string; score: number | null };

export function ScoreHistoryChart({ data }: { data: ScoreHistoryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="date" fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 10]} fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => (value === null ? "—" : Number(value).toFixed(1))}
        />
        <Line dataKey="score" stroke={CHART_COLORS.accent} strokeWidth={2} connectNulls dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
