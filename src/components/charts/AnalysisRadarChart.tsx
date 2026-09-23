"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

export type CategoryScore = { category: string; score: number };

export function AnalysisRadarChart({ data }: { data: CategoryScore[] }) {
  const t = useProfileTheme().voz.titulos;
  // O nome da série é o que o tooltip mostra ("Nota: 8 / 10"), então vem da voz do tema.
  const nota = t.grafNota;
  const chartData = data.map((d) => ({ category: d.category, [nota]: Number(d.score.toFixed(1)) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={chartData} outerRadius="75%">
        <PolarGrid stroke={CHART_COLORS.grid} />
        <PolarAngleAxis dataKey="category" fontSize={12} stroke={CHART_COLORS.axis} />
        <PolarRadiusAxis angle={90} domain={[0, 10]} fontSize={11} stroke={CHART_COLORS.axis} />
        <Radar dataKey={nota} stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.35} />
        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => t.grafNotaDeDez(String(value))} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
