"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClassAllocation } from "@/lib/consolidation/portfolio";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { formatPercentNumber } from "@/lib/format";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

const CLASS_LABEL: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  INTERNACIONAL: "Internacional",
  OUTRO: "Outro",
};

export function AllocationChart({ classes }: { classes: ClassAllocation[] }) {
  const t = useProfileTheme().voz.titulos;
  // O nome da série é o que o tooltip mostra, então ele vem da voz do tema. Só a alocação
  // atual: o ideal é o da Estratégia, mostrado na seção de cima (ver getAllocationByClass).
  const atual = t.grafAtual;
  const data = classes.map((c) => ({
    name: CLASS_LABEL[c.assetClass] ?? c.assetClass,
    [atual]: Number((c.currentPercent * 100).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" fontSize={12} stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} unit="%" stroke={CHART_COLORS.axis} tickLine={false} axisLine={false} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => formatPercentNumber(Number(value), 2)}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey={atual} fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
