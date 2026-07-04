"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function YearlyBarChart({ months }: { months: MonthlyBreakdown[] }) {
  const data = months.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    Renda: m.totalIncome,
    Gastos: m.totalExpense,
    Aportes: m.totalInvestment,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
        <Legend />
        <Bar dataKey="Renda" fill="#16a34a" />
        <Bar dataKey="Gastos" fill="#dc2626" />
        <Bar dataKey="Aportes" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  );
}
