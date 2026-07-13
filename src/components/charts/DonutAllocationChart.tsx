"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "./chart-theme";
import { formatPercentNumber } from "@/lib/format";

const SLICE_COLORS = [
  "var(--color-accent)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-danger)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

/** `id` é opcional (chamadores com rótulos já garantidamente únicos, ex.: uma fatia por
 * classe de ativo, não precisam informar) — quando presente, evita colisão de key quando
 * dois registros diferentes têm o mesmo `name` (ex.: dois ativos com o mesmo nome). */
export type DonutSlice = { id?: string; name: string; value: number };

export function DonutAllocationChart({ title, data }: { title: string; data: DonutSlice[] }) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            {/* Gradiente por fatia — mesmo tratamento moderno do SpendingPieChart. */}
            <defs>
              {SLICE_COLORS.map((color, i) => (
                <linearGradient key={i} id={`alloc-slice-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              cornerRadius={5}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.id ?? entry.name}
                  fill={`url(#alloc-slice-${index % SLICE_COLORS.length})`}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => formatPercentNumber(Number(value) * 100, 1)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-xs text-ink-faint">Sem dados ainda.</div>
      )}
    </div>
  );
}
