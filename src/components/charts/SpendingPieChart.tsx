"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "./chart-theme";
import { colorForCategorySlice } from "@/lib/categories";

export type SpendingSlice = {
  name: string;
  value: number;
  /** Referência da categoria (para abrir os lançamentos ao clicar). */
  category?: { kind: "parent" | "custom"; value: string };
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Pizza de gastos por categoria (substitui a antiga bolha): donut com o total no centro e uma
 * legenda que deixa claro o que é cada fatia, categoria, valor e %. Ordenada do maior gasto
 * para o menor, então bate o olho e entende para onde o dinheiro foi.
 */
export function SpendingPieChart({
  data,
  onSelect,
  selectedName,
}: {
  data: SpendingSlice[];
  /** Quando presente, cada linha da legenda vira clicável (abre os lançamentos da categoria). */
  onSelect?: (slice: SpendingSlice) => void;
  /** Nome da categoria atualmente aberta, destaca a linha. */
  selectedName?: string | null;
}) {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-ink-faint">
        Nenhum gasto neste período.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Gradientes radiais por fatia, a cor é fixa por CATEGORIA (colorForCategorySlice),
                nunca por posição no ranking, senão a mesma categoria mudaria de cor a cada
                período conforme o que gastou mais naquele mês. */}
            <defs>
              {slices.map((entry, i) => {
                const color = colorForCategorySlice(entry.category);
                return (
                  <linearGradient key={entry.name} id={`spending-slice-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                  </linearGradient>
                );
              })}
            </defs>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={2}
              cornerRadius={6}
              isAnimationActive={false}
            >
              {slices.map((entry, index) => (
                <Cell key={entry.name} fill={`url(#spending-slice-${index})`} stroke="none" />
              ))}
            </Pie>
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => formatBRL(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-caption text-ink-muted">Total</span>
          <span className="text-lg font-semibold tabular-nums text-ink">{formatBRL(total)}</span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1">
        {slices.map((slice) => {
          const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const clickable = Boolean(onSelect && slice.category);
          const isSelected = selectedName === slice.name;
          const dot = (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForCategorySlice(slice.category) }} />
          );
          const content = (
            <>
              {dot}
              <span className="min-w-0 flex-1 truncate text-left text-sm text-ink">{slice.name}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatBRL(slice.value)}</span>
              <span className="w-9 shrink-0 text-right text-caption tabular-nums text-ink-faint">{percent}%</span>
            </>
          );
          return (
            <li key={slice.name}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(slice)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
