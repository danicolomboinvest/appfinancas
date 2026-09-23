"use client";

import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Linha = { name: string; Receita: number; Despesas: number; Lucro: number; realizado: boolean };

/**
 * O gráfico clássico de painel de empresa: receita e despesas lado a lado, mês a mês, com o
 * lucro como linha por cima. Meses futuros (só recorrência lançada) ficam apagados: são
 * previsão, não resultado. É a versão de negócio do "renda × gastos" da pessoa física, que
 * desenha a renda como continente; aqui a pergunta é outra: a receita cobre a despesa, e por
 * quanto?
 */
export function ReceitaDespesaLucroChart({ months }: { months: MonthlyBreakdown[] }) {
  const money = useMoney();
  const dados: Linha[] = months.map((m) => ({
    name: MESES[m.month - 1],
    Receita: m.totalIncome,
    Despesas: m.totalExpense,
    Lucro: m.totalIncome - m.totalExpense,
    realizado: m.isRealized,
  }));
  const compacto = (v: number) => money(v, { round: true }).replace(/,\d\d$/, "");

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} width={64} tickFormatter={compacto} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-surface-2)" }}
            formatter={(v, nome) => [money(Number(v)), nome as string]}
          />
          <Bar dataKey="Receita" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {dados.map((d) => (
              <Cell key={d.name} fill={CHART_COLORS.success} fillOpacity={d.realizado ? 0.85 : 0.3} />
            ))}
          </Bar>
          <Bar dataKey="Despesas" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {dados.map((d) => (
              <Cell key={d.name} fill={CHART_COLORS.danger} fillOpacity={d.realizado ? 0.75 : 0.3} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="Lucro" stroke="var(--color-ink)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--color-ink)" }} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
