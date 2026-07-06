"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClassAllocation } from "@/lib/consolidation/portfolio";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

const CLASS_LABEL: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  OUTRO: "Outro",
};

export function AllocationChart({ classes }: { classes: ClassAllocation[] }) {
  const data = classes.map((c) => ({
    name: CLASS_LABEL[c.assetClass] ?? c.assetClass,
    Atual: Number((c.currentPercent * 100).toFixed(2)),
    Ideal: Number((c.idealPercent * 100).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} unit="%" stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => `${value}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        <Bar dataKey="Atual" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Ideal" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
