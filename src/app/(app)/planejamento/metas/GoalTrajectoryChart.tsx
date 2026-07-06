"use client";

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import type { GoalTrajectoryPoint } from "@/lib/planning/goal";

const TONE_COLOR: Record<"success" | "accent" | "danger", string> = {
  success: CHART_COLORS.success,
  accent: CHART_COLORS.accent,
  danger: CHART_COLORS.danger,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Sparkline da trajetória PROJETADA de uma meta (não histórica — ver computeGoalTrajectory).
 * Deliberadamente sem eixos/grid: o objetivo é uma leitura rápida da tendência, não uma
 * análise detalhada ponto a ponto.
 */
export function GoalTrajectoryChart({
  data,
  targetAmount,
  tone,
}: {
  data: GoalTrajectoryPoint[];
  targetAmount: number;
  tone: "success" | "accent" | "danger";
}) {
  if (data.length < 2) return null;
  const color = TONE_COLOR[tone];
  const gradientId = `goal-trajectory-${tone}`;

  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ReferenceLine y={targetAmount} stroke={CHART_COLORS.muted} strokeDasharray="3 3" />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          labelFormatter={(month) => (Number(month) === 0 ? "Hoje" : `Daqui a ${month} meses`)}
          formatter={(value) => formatBRL(Number(value))}
        />
        <Area type="monotone" dataKey="amount" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
