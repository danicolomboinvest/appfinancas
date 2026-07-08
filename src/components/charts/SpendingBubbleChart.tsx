"use client";

import { Cell, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { CHART_TOOLTIP_STYLE } from "./chart-theme";

const SLICE_COLORS = [
  "var(--color-accent)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-danger)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

export type BubbleDatum = { name: string; value: number };

/** Raio fixo do layout radial — não há biblioteca de circle-packing instalada, então as bolhas
 * são distribuídas em círculo (ângulo = índice/total × 360°) com o tamanho vindo do ZAxis. */
const RADIUS = 100;
const DOMAIN: [number, number] = [-140, 140];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SpendingBubbleChart({ data }: { data: BubbleDatum[] }) {
  const filtered = data.filter((d) => d.value > 0);
  const points = filtered.map((d, index) => {
    const angle = (index / filtered.length) * 2 * Math.PI - Math.PI / 2;
    return { name: d.name, value: d.value, x: RADIUS * Math.cos(angle), y: RADIUS * Math.sin(angle) };
  });

  if (points.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center text-xs text-ink-faint">
        Sem gastos neste mês ainda.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 30, right: 30, bottom: 20, left: 30 }}>
        <XAxis type="number" dataKey="x" domain={DOMAIN} hide />
        <YAxis type="number" dataKey="y" domain={DOMAIN} hide />
        <ZAxis type="number" dataKey="value" range={[600, 5000]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0].payload as BubbleDatum;
            return (
              <div style={CHART_TOOLTIP_STYLE.contentStyle}>
                <p style={CHART_TOOLTIP_STYLE.labelStyle}>{point.name}</p>
                <p style={CHART_TOOLTIP_STYLE.itemStyle}>{formatBRL(point.value)}</p>
              </div>
            );
          }}
        />
        <Scatter data={points} fillOpacity={0.85}>
          {points.map((entry, index) => (
            <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
          ))}
          <LabelList dataKey="name" position="top" style={{ fontSize: 11, fill: "var(--color-ink-muted)" }} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
