"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancingVsRentMonth } from "@/lib/simulators/financing-vs-rent";

export function FinancingVsRentChart({ schedule }: { schedule: FinancingVsRentMonth[] }) {
  const data = schedule
    .filter((row) => row.month % 6 === 0 || row.month === schedule.length)
    .map((row) => ({
      mes: row.month,
      Financiar: row.financingPatrimony,
      "Alugar + investir": row.investedPatrimony,
    }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mes" fontSize={12} label={{ value: "Mês", position: "insideBottom", offset: -5 }} />
        <YAxis fontSize={12} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Legend />
        <Line type="monotone" dataKey="Financiar" stroke="#2563eb" dot={false} />
        <Line type="monotone" dataKey="Alugar + investir" stroke="#16a34a" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
