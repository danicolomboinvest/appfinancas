"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "./chart-theme";

const SLICE_COLORS = ["#2f7b6f", "#60a5fa", "#34d399", "#f87171", "#a78bfa", "#f59e0b", "#767572"];

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
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-xs text-ink-faint">Sem dados ainda.</div>
      )}
    </div>
  );
}
