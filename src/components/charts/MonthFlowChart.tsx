"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyFlowPoint } from "@/lib/consolidation/month-analysis";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";


/**
 * A curva do mês: quanto entrou e quanto saiu, acumulado dia a dia. Diferente do gráfico de
 * barras por mês (que compara meses fechados), este responde "como este mês está indo ATÉ
 * AGORA".
 *
 * Acumulado (e não valor por dia) de propósito: gasto diário é serrilhado e cheio de zeros
 * (ninguém gasta todo santo dia), o que vira um gráfico nervoso e ilegível; acumulado sobe
 * suave e deixa a inclinação contar a história — quanto mais íngreme, mais rápido o dinheiro
 * está indo embora.
 *
 * A FAIXA ENTRE AS DUAS LINHAS é preenchida, e essa é a mudança que faz o gráfico responder
 * sozinho: antes havia uma frase embaixo explicando que a distância entre as linhas era o que
 * sobrou. Quando é preciso escrever o que o gráfico quer dizer, o gráfico não está dizendo.
 *
 * Como a faixa é desenhada: o Recharts não preenche "entre duas séries", então vão duas áreas
 * empilhadas — uma base invisível na altura da linha de baixo e, em cima dela, a diferença
 * entre as duas. Empilhar (em vez de pintar do zero e cobrir) é o que mantém o desenho correto
 * nos meses em que o gasto passa a renda e a faixa inverte de lado.
 */
export function MonthFlowChart({ points }: { points: DailyFlowPoint[] }) {
  const money = useMoney();
  const data = points.map((p) => ({
    day: p.day,
    Renda: p.income,
    Gastos: p.expense,
    faixaBase: Math.min(p.income, p.expense),
    faixa: Math.abs(p.income - p.expense),
  }));

  const last = points[points.length - 1];
  const leftover = last ? last.income - last.expense : 0;
  const positive = leftover >= 0;
  const bandColor = positive ? CHART_COLORS.success : CHART_COLORS.danger;

  // Uns 5 rótulos no eixo X bastam (1, 8, 15, 22, 29): com 30 dias escritos o eixo vira borrão
  // no celular. O passo se ajusta a meses curtos/parciais pra nunca amontoar.
  const step = Math.max(1, Math.ceil(points.length / 5));
  const ticks = points.filter((_, i) => i % step === 0).map((p) => p.day);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={220}>
        {/* Margem direita generosa: é onde ficam os valores das pontas, que substituíram o eixo Y. */}
        <ComposedChart data={data} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            ticks={ticks}
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(day) => `${day}`}
          />
          {/* Eixo Y existe só pra escala; some da tela. Os dois números que importam estão
              escritos na ponta das linhas, que é onde o olho já está. */}
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            labelFormatter={(day) => `Dia ${day}`}
            formatter={(value, name) => {
              if (name === "faixa" || name === "faixaBase") return [];
              return [money(Number(value), { round: true }), name === "Renda" ? "Entrou" : "Saiu"];
            }}
            cursor={{ stroke: CHART_COLORS.grid }}
          />
          <Area
            type="monotone"
            dataKey="faixaBase"
            stackId="faixa"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="faixa"
            stackId="faixa"
            stroke="none"
            fill={bandColor}
            fillOpacity={0.16}
            isAnimationActive={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="Renda"
            stroke={CHART_COLORS.success}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Gastos"
            stroke={CHART_COLORS.danger}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Os valores das pontas viram chips embaixo em vez de texto solto dentro do SVG: no
          celular um rótulo dentro do gráfico encosta na borda e some, o chip sempre cabe. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" />
          Entrou {money(last?.income ?? 0, { round: true })}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-caption font-medium text-danger">
          <span className="size-1.5 rounded-full bg-danger" />
          Saiu {money(last?.expense ?? 0, { round: true })}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink">
          {positive ? "Sobrou" : "Faltou"} até aqui: {money(Math.abs(leftover), { round: true })}
        </span>
      </div>
    </div>
  );
}
