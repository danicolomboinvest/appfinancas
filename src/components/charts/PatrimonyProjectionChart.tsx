"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectionYear } from "@/lib/consolidation/projection";

export function PatrimonyProjectionChart({ years }: { years: ProjectionYear[] }) {
  const data = years.map((y) => ({
    idade: y.age,
    "Patrimônio (nominal)": y.balanceNominal,
    "Patrimônio (real)": y.balanceReal,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="idade" fontSize={12} label={{ value: "Idade", position: "insideBottom", offset: -5 }} />
        <YAxis fontSize={12} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Legend />
        <Line type="monotone" dataKey="Patrimônio (nominal)" stroke="#2563eb" dot={false} connectNulls />
        <Line type="monotone" dataKey="Patrimônio (real)" stroke="#16a34a" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
