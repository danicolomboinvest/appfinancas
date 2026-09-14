"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyFlowPoint } from "@/lib/consolidation/month-analysis";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";

/** 12500 → "12,5k"; abaixo de mil mostra o número seco, pra não virar "0,3k". */
function abbrev(value: number): string {
  const a = Math.abs(value);
  if (a >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return String(Math.round(value));
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * A curva do mês: quanto entrou e quanto saiu, acumulado dia a dia. Diferente do gráfico de
 * barras por mês (que compara meses fechados), este responde "como este mês está indo ATÉ
 * AGORA" — a distância entre as duas linhas é, visualmente, o que sobrou.
 *
 * Acumulado (e não valor por dia) de propósito: gasto diário é serrilhado e cheio de zeros
 * (ninguém gasta todo santo dia), o que vira um gráfico nervoso e ilegível; acumulado sobe
 * suave e deixa a inclinação contar a história — quanto mais íngreme, mais rápido o dinheiro
 * está indo embora.
 */
export function MonthFlowChart({ points }: { points: DailyFlowPoint[] }) {
  const data = points.map((p) => ({
    day: p.day,
    Renda: p.income,
    Gastos: p.expense,
  }));

  // Uns 5 rótulos no eixo X bastam (1, 8, 15, 22, 29): com 30 dias escritos o eixo vira borrão
  // no celular. O passo se ajusta a meses curtos/parciais pra nunca amontoar.
  const step = Math.max(1, Math.ceil(points.length / 5));
  const ticks = points.filter((_, i) => i % step === 0).map((p) => p.day);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="monthFlowIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="monthFlowExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.danger} stopOpacity={0.24} />
            <stop offset="100%" stopColor={CHART_COLORS.danger} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="day"
          ticks={ticks}
          fontSize={11}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          tickFormatter={(day) => `${day}`}
        />
        <YAxis
          fontSize={11}
          stroke={CHART_COLORS.axis}
          tickLine={false}
          axisLine={false}
          width={42}
          tickFormatter={abbrev}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          labelFormatter={(day) => `Dia ${day}`}
          formatter={(value, name) => [formatBRL(Number(value)), name === "Renda" ? "Entrou" : "Saiu"]}
          cursor={{ stroke: CHART_COLORS.grid }}
        />
        <Area
          type="monotone"
          dataKey="Renda"
          stroke={CHART_COLORS.success}
          strokeWidth={2}
          fill="url(#monthFlowIncome)"
          // Ponto só na ponta: marca "você está aqui" sem sujar a linha inteira de bolinhas.
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="Gastos"
          stroke={CHART_COLORS.danger}
          strokeWidth={2}
          fill="url(#monthFlowExpense)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
