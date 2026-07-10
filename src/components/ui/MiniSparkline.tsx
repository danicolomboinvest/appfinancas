"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/components/charts/chart-theme";

type TooltipPayloadEntry = { payload?: SparklinePoint };

function SparklineTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point) return null;
  return (
    <div style={{ ...CHART_TOOLTIP_STYLE.contentStyle, padding: "6px 10px" }}>
      <p style={{ ...CHART_TOOLTIP_STYLE.labelStyle, margin: 0 }}>{point.label}</p>
      <p style={{ ...CHART_TOOLTIP_STYLE.itemStyle, margin: 0, fontWeight: 600 }}>{valueFormatter(point.value)}</p>
    </div>
  );
}

const TONE_COLOR: Record<"success" | "danger" | "accent" | "neutral", string> = {
  success: CHART_COLORS.success,
  danger: CHART_COLORS.danger,
  accent: CHART_COLORS.accent,
  neutral: CHART_COLORS.muted,
};

export type SparklinePoint = { label: string; value: number };

function defaultValueFormatter(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Sparkline compacta para cards de indicador — sem eixos/grid visíveis, mas com tooltip ao passar o mouse. */
export function MiniSparkline({
  points,
  tone = "neutral",
  height = 40,
  valueFormatter = defaultValueFormatter,
}: {
  points: SparklinePoint[];
  tone?: "success" | "danger" | "accent" | "neutral";
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  if (points.length < 2 || points.every((p) => p.value === 0)) return null;
  const color = TONE_COLOR[tone];
  const gradientId = `sparkline-${tone}-${height}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <Tooltip
          trigger="click"
          content={<SparklineTooltip valueFormatter={valueFormatter} />}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
