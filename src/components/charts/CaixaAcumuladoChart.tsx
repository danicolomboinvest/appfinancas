"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * O "caixa no fim de cada mês" dos painéis de empresa: parte do caixa que a empresa tem
 * marcado como reserva e soma o resultado de cada mês (o que ficou depois de despesas e
 * retenção vai pro caixa; a retenção também, porque é a própria reserva). Só meses realizados:
 * previsão de caixa é outra conversa, e uma linha que cai no futuro por falta de lançamento
 * assustaria sem motivo.
 */
export function CaixaAcumuladoChart({ months, caixaInicial }: { months: MonthlyBreakdown[]; caixaInicial: number }) {
  const money = useMoney();
  const realizados = months.filter((m) => m.isRealized);
  // Caixa hoje = caixa marcado na carteira. Pra desenhar o caminho, anda pra trás: cada mês
  // anterior tinha o caixa de hoje menos o que os meses seguintes acrescentaram.
  const contribuicao = realizados.map((m) => m.totalIncome - m.totalExpense);
  const totalAno = contribuicao.reduce((s, v) => s + v, 0);
  const dados = realizados.reduce<{ acumulado: number; linhas: { name: string; Caixa: number }[] }>(
    (s, m, i) => {
      const acumulado = s.acumulado + contribuicao[i];
      return { acumulado, linhas: [...s.linhas, { name: MESES[m.month - 1], Caixa: Math.round(acumulado) }] };
    },
    { acumulado: caixaInicial - totalAno, linhas: [] },
  ).linhas;
  const compacto = (v: number) => money(v, { round: true }).replace(/,\d\d$/, "");

  return (
    <div className="h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="caixaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} width={64} tickFormatter={compacto} />
          <ReferenceLine y={0} stroke={CHART_COLORS.grid} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [money(Number(v)), "Caixa no fim do mês"]} />
          <Area type="monotone" dataKey="Caixa" stroke={CHART_COLORS.accentStrong} strokeWidth={2} fill="url(#caixaGrad)" dot={{ r: 2.5, fill: CHART_COLORS.accentStrong }} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
