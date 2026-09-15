"use client";

import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Meses futuros (recorrência programada, ainda não realizada) ficam quase transparentes. */
const PROJECTED_OPACITY = 0.3;

type Row = {
  name: string;
  Renda: number;
  Gastos: number;
  Aportes: number;
  /** Altura de referência da coluna; ver comentário em `MonthColumn`. */
  escala: number;
  /** Total planejado do mês (linha tracejada); nulo quando não há orçamento preenchido. */
  Planejado: number | null;
  isRealized: boolean;
  isCurrent: boolean;
};


/**
 * Uma coluna por mês, desenhada à mão em vez de três barras lado a lado do Recharts.
 *
 * A ideia que o desenho precisa carregar: a RENDA é o continente, gastos e aportes são o que
 * coube dentro dela, e o espaço verde vazio no topo é o que sobrou. Com três barras lado a
 * lado isso não aparece — a pessoa tinha que comparar três alturas de cabeça pra descobrir se
 * sobrou dinheiro. Aqui sobra é literalmente o vazio, e some quando não sobrou nada.
 *
 * De quebra, uma coluna por mês em vez de três cabe no celular sem virar peneira.
 *
 * `escala` existe porque a altura em pixels que o Recharts entrega corresponde ao valor da
 * série desenhada. Se essa série fosse a renda, um mês sem renda lançada teria altura zero e
 * os gastos daquele mês sumiriam da tela. Então a série é o MAIOR entre renda e (gastos +
 * aportes), e cada retângulo é uma fração dessa altura — o mês estourado desenha certo.
 */
function MonthColumn(props: unknown) {
  const { x, y, width, height, payload } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: Row;
  };
  const { Renda, Gastos, Aportes, escala, isRealized } = payload;
  if (escala <= 0 || height <= 0) return null;

  const px = (value: number) => (value / escala) * height;
  const bottom = y + height;
  const innerWidth = Math.max(width * 0.52, 6);
  const innerX = x + (width - innerWidth) / 2;
  const opacity = isRealized ? 1 : PROJECTED_OPACITY;

  const rendaH = px(Renda);
  const gastosH = px(Gastos);
  const aportesH = px(Aportes);

  return (
    <g opacity={opacity}>
      {rendaH > 0 && (
        <rect
          x={x}
          y={bottom - rendaH}
          width={width}
          height={rendaH}
          rx={4}
          fill={CHART_COLORS.success}
          fillOpacity={0.18}
          stroke={CHART_COLORS.success}
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      )}
      {gastosH > 0 && (
        <rect x={innerX} y={bottom - gastosH} width={innerWidth} height={gastosH} rx={3} fill={CHART_COLORS.danger} />
      )}
      {aportesH > 0 && (
        // 2px de respiro separam aportes de gastos, senão viram um bloco só de duas cores.
        <rect
          x={innerX}
          y={bottom - gastosH - aportesH - 2}
          width={innerWidth}
          height={aportesH}
          rx={3}
          fill={CHART_COLORS.accent}
        />
      )}
    </g>
  );
}

function ColumnTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const money = useMoney();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const sobrou = row.Renda - row.Gastos - row.Aportes;
  return (
    <div style={{ ...CHART_TOOLTIP_STYLE.contentStyle, padding: "8px 12px" }}>
      <p style={{ ...CHART_TOOLTIP_STYLE.labelStyle, margin: "0 0 4px" }}>
        {row.name}
        {!row.isRealized && " (previsto)"}
      </p>
      <p style={{ margin: 0, color: CHART_COLORS.success }}>Renda {money(row.Renda, { round: true })}</p>
      <p style={{ margin: 0, color: CHART_COLORS.danger }}>Gastos {money(row.Gastos, { round: true })}</p>
      <p style={{ margin: 0, color: CHART_COLORS.accent }}>Aportes {money(row.Aportes, { round: true })}</p>
      {row.Planejado != null && (
        <p style={{ margin: 0, color: CHART_COLORS.accentStrong }}>Planejado {money(row.Planejado, { round: true })}</p>
      )}
      <p style={{ margin: "4px 0 0", color: "var(--color-ink)", fontWeight: 600 }}>
        {sobrou >= 0 ? "Sobrou" : "Faltou"} {money(Math.abs(sobrou), { round: true })}
      </p>
    </div>
  );
}

const LEGEND = [
  { label: "Renda", className: "border border-success/50 bg-success/20" },
  { label: "Gastos", className: "bg-danger" },
  { label: "Aportes", className: "bg-accent" },
];

export function YearlyBarChart({
  months,
  plannedByMonth,
}: {
  months: MonthlyBreakdown[];
  /** Total planejado (soma das categorias) por número do mês (1-12), de getAnnualPlannedVsActual. */
  plannedByMonth?: Record<number, number>;
}) {
  // Mês atual = o último que já aconteceu. É o único rótulo em negrito, pra dar o "você está
  // aqui" sem precisar de linha vertical nem legenda extra.
  let currentMonth = 0;
  for (const m of months) if (m.isRealized) currentMonth = m.month;

  const data: Row[] = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Renda: m.totalIncome,
    Gastos: m.totalExpense,
    Aportes: m.totalInvestment,
    escala: Math.max(m.totalIncome, m.totalExpense + m.totalInvestment),
    Planejado: plannedByMonth?.[m.month] ? plannedByMonth[m.month] : null,
    isRealized: m.isRealized,
    isCurrent: m.month === currentMonth,
  }));

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="name"
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            interval={0}
            // O tipo do Recharts para `tick` é largo demais (x/y podem ser string); normalizo
            // aqui em vez de espalhar `as number` pelo JSX.
            tick={(props) => {
              const { x, y, index, payload } = props as unknown as {
                x: number;
                y: number;
                index: number;
                payload: { value: string };
              };
              const row = data[index];
              return (
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={row?.isCurrent ? 700 : 400}
                  fill={row?.isCurrent ? "var(--color-ink)" : CHART_COLORS.axis}
                  opacity={row?.isRealized ? 1 : 0.5}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          {/* Sem eixo Y e sem grade: a comparação aqui é entre colunas, não com números
              absolutos — quem quer o valor toca na coluna e lê no tooltip. */}
          <YAxis hide />
          <Tooltip content={<ColumnTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
          <Bar dataKey="escala" shape={MonthColumn} maxBarSize={30} isAnimationActive={false} />
          {plannedByMonth && (
            // O planejado atravessa as colunas como linha: acima da barra de gastos, o mês
            // ficou dentro do plano; abaixo, estourou.
            <Line
              dataKey="Planejado"
              stroke={CHART_COLORS.accentStrong}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className={`size-2.5 rounded-sm ${l.className}`} />
            {l.label}
          </span>
        ))}
        {plannedByMonth && (
          <span className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-accent-strong" />
            Planejado
          </span>
        )}
      </div>
    </div>
  );
}
