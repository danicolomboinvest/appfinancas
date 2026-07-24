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
 * classe de ativo, não precisam informar), quando presente, evita colisão de key quando
 * dois registros diferentes têm o mesmo `name` (ex.: dois ativos com o mesmo nome). */
export type DonutSlice = { id?: string; name: string; value: number; color?: string };

export function DonutAllocationChart({
  title,
  data,
  onSelect,
  selectedName,
  legend = false,
}: {
  title: string;
  data: DonutSlice[];
  /** Quando presente, o gráfico ganha legenda clicável, clicar numa fatia/linha seleciona. */
  onSelect?: (slice: DonutSlice) => void;
  selectedName?: string | null;
  /** Mostra a legenda (cor + nome + %) mesmo sem `onSelect` — só decorativa, sem clique. */
  legend?: boolean;
}) {
  const hasData = data.some((d) => d.value > 0);
  const interactive = onSelect !== undefined;
  const showLegend = interactive || legend;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              {/* Gradiente por fatia, mesmo tratamento moderno do SpendingPieChart. */}
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
                onClick={interactive ? (entry) => onSelect?.(entry.payload as DonutSlice) : undefined}
                style={interactive ? { cursor: "pointer" } : undefined}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.id ?? entry.name}
                    // Cor fixa da categoria quando informada (comparação consistente entre gráficos);
                    // senão, o gradiente padrão por posição.
                    fill={entry.color ?? `url(#alloc-slice-${index % SLICE_COLORS.length})`}
                    stroke="none"
                    opacity={selectedName && selectedName !== entry.name ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => formatPercentNumber(Number(value) * 100, 1)} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legenda: cor + nome + percentual. Clicável (filtra ao toque) só quando `onSelect`
              foi passado; senão é só decorativa, pra sempre dar pra ler o que cada cor é. */}
          {showLegend && (
            <div className="flex w-full flex-wrap justify-center gap-1.5">
              {data.map((entry, index) => {
                const active = selectedName === entry.name;
                const Tag = interactive ? "button" : "div";
                return (
                  <Tag
                    key={entry.id ?? entry.name}
                    type={interactive ? "button" : undefined}
                    onClick={interactive ? () => onSelect?.(entry) : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-border bg-surface-2 text-ink-muted hover:text-ink"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: entry.color ?? SLICE_COLORS[index % SLICE_COLORS.length] }}
                    />
                    {entry.name}
                    <span className="tabular-nums text-ink-faint">{formatPercentNumber(entry.value * 100, 1)}</span>
                  </Tag>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-xs text-ink-faint">Sem dados ainda.</div>
      )}
    </div>
  );
}
