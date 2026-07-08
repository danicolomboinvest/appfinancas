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

export type DonutSlice = { name: string; value: number };

export function DonutAllocationChart({ title, data }: { title: string; data: DonutSlice[] }) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} stroke="none" />
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
