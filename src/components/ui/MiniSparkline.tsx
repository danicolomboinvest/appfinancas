"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/components/charts/chart-theme";

const TONE_COLOR: Record<"success" | "danger" | "accent" | "neutral", string> = {
  success: CHART_COLORS.success,
  danger: CHART_COLORS.danger,
  accent: CHART_COLORS.accent,
  neutral: CHART_COLORS.muted,
};

/** Sparkline decorativa e compacta para cards de indicador — sem eixos, grid ou tooltip. */
export function MiniSparkline({
  values,
  tone = "neutral",
  height = 40,
}: {
  values: number[];
  tone?: "success" | "danger" | "accent" | "neutral";
  height?: number;
}) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const color = TONE_COLOR[tone];
  const gradientId = `sparkline-${tone}-${height}`;
  const data = values.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
