"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SavingsProjectionChart({
  projection,
  targetAmount,
}: {
  projection: { month: number; balance: number }[];
  targetAmount: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={projection}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} label={{ value: "Mês", position: "insideBottom", offset: -5 }} />
        <YAxis fontSize={12} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <ReferenceLine y={targetAmount} stroke="#dc2626" strokeDasharray="4 4" label="Meta" />
        <Area type="monotone" dataKey="balance" stroke="#2563eb" fill="#2563eb33" name="Saldo" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
