"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClassAllocation } from "@/lib/consolidation/portfolio";

const CLASS_LABEL: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  OUTRO: "Outro",
};

export function AllocationChart({ classes }: { classes: ClassAllocation[] }) {
  const data = classes.map((c) => ({
    name: CLASS_LABEL[c.assetClass] ?? c.assetClass,
    Atual: Number((c.currentPercent * 100).toFixed(2)),
    Ideal: Number((c.idealPercent * 100).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} unit="%" />
        <Tooltip formatter={(value) => `${value}%`} />
        <Legend />
        <Bar dataKey="Atual" fill="#2563eb" />
        <Bar dataKey="Ideal" fill="#94a3b8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
