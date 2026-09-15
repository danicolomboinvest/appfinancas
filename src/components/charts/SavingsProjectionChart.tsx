"use client";

import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "./chart-theme";
import { useMoney } from "@/components/money/MoneyProvider";


/**
 * Projeção da reserva de emergência.
 *
 * Duas mudanças que vieram do desenho aprovado. A primeira: a linha da META passa a ser
 * desenhada COM o valor escrito nela — antes existia uma linha pontilhada dizendo só "Meta", e
 * "quanto falta" virava uma conta de cabeça entre a curva e uma legenda muda.
 *
 * A segunda: o ponto de HOJE ganha o valor ao lado. Sem isso a curva começa do nada, e a
 * pessoa não sabe qual pedaço já é dela e qual é promessa.
 *
 * A linha inteira é tracejada de propósito, e isso é honestidade, não estilo: o app não guarda
 * o histórico mensal da reserva, só o saldo de hoje. Tudo daqui pra frente é projeção em cima
 * do aporte informado — desenhar parte dela como linha cheia sugeriria um passado registrado
 * que não existe.
 */
export function SavingsProjectionChart({
  projection,
  targetAmount,
  currentAmount,
  /** Rótulo do mês em que a reserva fica pronta, ex.: "junho de 2027"; null se inatingível. */
  completionLabel,
}: {
  projection: { month: number; balance: number }[];
  targetAmount: number;
  currentAmount: number;
  completionLabel?: string | null;
}) {
  const money = useMoney();
  const missing = Math.max(targetAmount - currentAmount, 0);
  const progress = targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
  const first = projection[0];

  // A escala precisa caber a meta, senão a linha da meta sai pra fora do gráfico quando a
  // reserva ainda está baixa — que é justamente quando ela mais importa.
  const maxBalance = Math.max(...projection.map((p) => p.balance), targetAmount);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={projection} margin={{ top: 22, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="savings-projection-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.26} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            fontSize={11}
            stroke={CHART_COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(month) => (month === 0 ? "hoje" : `${month}m`)}
          />
          <YAxis hide domain={[0, maxBalance * 1.12]} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            labelFormatter={(month) => (month === 0 ? "Hoje" : `Daqui a ${month} ${month === 1 ? "mês" : "meses"}`)}
            formatter={(value) => [money(Number(value), { round: true }), "Reserva"]}
            cursor={{ stroke: CHART_COLORS.grid }}
          />
          <ReferenceLine
            y={targetAmount}
            stroke={CHART_COLORS.success}
            strokeDasharray="4 4"
            label={{
              value: `meta ${money(targetAmount, { round: true })}`,
              position: "insideTopRight",
              fill: CHART_COLORS.success,
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="url(#savings-projection-fill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          {/* Só o ponto dentro do gráfico; o VALOR de hoje vai no chip abaixo. Escrito aqui,
              o rótulo do primeiro ponto nasce colado na borda esquerda e é cortado pela
              metade — no celular some quase inteiro. */}
          {first && <ReferenceDot x={first.month} y={first.balance} r={4} fill={CHART_COLORS.accent} stroke="none" />}
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent-strong">
          <span className="size-1.5 rounded-full bg-accent" />
          Hoje: {money(currentAmount, { round: true })}
        </span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
          {Math.round(progress * 100)}% pronta
        </span>
        {missing > 0 && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink">
            Falta {money(missing, { round: true })}
          </span>
        )}
        {completionLabel && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink">
            Completa em {completionLabel}
          </span>
        )}
      </div>
    </div>
  );
}
