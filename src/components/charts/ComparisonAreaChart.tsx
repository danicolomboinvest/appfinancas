"use client";

import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export type ComparisonPoint = { x: number; a: number; b: number };

/**
 * Duas opções ao longo do tempo, uma área cada, com o valor final escrito na ponta.
 *
 * É o gráfico que faltava nos simuladores: eles entregavam a resposta como número e
 * parágrafo, e quem simula "financiar ou alugar" quer ver as duas curvas se cruzando — o
 * ponto em que uma passa a outra é a informação, e ele não existe em texto.
 *
 * Os valores finais vão em chips embaixo, não como rótulo dentro do SVG: escritos na ponta
 * da curva, nascem colados na borda direita e são cortados no celular.
 */
export function ComparisonAreaChart({
  points,
  labelA,
  labelB,
  /** Como escrever o eixo X: "24" vira "24 meses" ou "ano 24". */
  xUnit = "mês",
  /** Frase do veredito, ex.: "Alugar sai R$ 125 mil à frente em 20 anos". */
  verdict,
  /** Qual das duas ganhou — colore o chip do veredito. */
  winner = "a",
}: {
  points: ComparisonPoint[];
  labelA: string;
  labelB: string;
  xUnit?: "mês" | "ano";
  verdict?: string;
  winner?: "a" | "b";
}) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const colorA = CHART_COLORS.success;
  const colorB = CHART_COLORS.info;

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cmp-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorA} stopOpacity={0.26} />
              <stop offset="100%" stopColor={colorA} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cmp-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorB} stopOpacity={0.2} />
              <stop offset="100%" stopColor={colorB} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="x"
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(x) => (xUnit === "ano" ? `${x}a` : `${x}m`)}
          />
          {/* Sem eixo Y: a comparação é entre as duas curvas, e os dois números que importam
              estão nos chips. Um eixo de reais aqui só rouba largura no celular. */}
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            labelFormatter={(x) => (xUnit === "ano" ? `Ano ${x}` : `Mês ${x}`)}
            formatter={(value, name) => [formatBRL(Number(value)), name === "a" ? labelA : labelB]}
            cursor={{ stroke: CHART_COLORS.grid }}
          />
          <Area type="monotone" dataKey="a" stroke={colorA} strokeWidth={2} fill="url(#cmp-a)" dot={false} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="b" stroke={colorB} strokeWidth={2} fill="url(#cmp-b)" dot={false} activeDot={{ r: 4 }} />
          <ReferenceDot x={last.x} y={last.a} r={4} fill={colorA} stroke="none" />
          <ReferenceDot x={last.x} y={last.b} r={4} fill={colorB} stroke="none" />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {labelA}: {formatBRL(last.a)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-caption font-medium text-info">
          <span className="size-1.5 rounded-full bg-info" />
          {labelB}: {formatBRL(last.b)}
        </span>
      </div>
      {verdict && (
        <p
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            winner === "a" ? "bg-success-soft text-success" : "bg-info-soft text-info"
          }`}
        >
          {verdict}
        </p>
      )}
    </div>
  );
}
