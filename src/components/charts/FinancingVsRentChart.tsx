"use client";

import type { FinancingVsRentMonth } from "@/lib/simulators/financing-vs-rent";
import { ComparisonAreaChart, type ComparisonPoint } from "./ComparisonAreaChart";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Financiar × Alugar e investir. Hoje é o gráfico de comparação padrão dos simuladores
 * vestido com os dados deste — o ponto em que uma curva cruza a outra é a resposta, e era
 * justamente isso que o número final sozinho não contava.
 */
export function FinancingVsRentChart({
  schedule,
  winner,
}: {
  schedule: FinancingVsRentMonth[];
  winner: "FINANCIAR" | "ALUGAR_E_INVESTIR";
}) {
  // Um ponto a cada 6 meses (mais o último): mês a mês são centenas de pontos que o olho não
  // distingue e que o celular sofre pra desenhar.
  const points: ComparisonPoint[] = schedule
    .filter((row) => row.month % 6 === 0 || row.month === schedule.length)
    .map((row) => ({ x: row.month, a: row.investedPatrimony, b: row.financingPatrimony }));

  const last = points[points.length - 1];
  const anos = Math.round(schedule.length / 12);
  const diferenca = last ? Math.abs(last.a - last.b) : 0;
  const verdict =
    winner === "ALUGAR_E_INVESTIR"
      ? `Alugar e investir sai ${formatBRL(diferenca)} à frente em ${anos} anos.`
      : `Financiar sai ${formatBRL(diferenca)} à frente em ${anos} anos.`;

  return (
    <ComparisonAreaChart
      points={points}
      labelA="Alugar + investir"
      labelB="Financiar"
      verdict={verdict}
      winner={winner === "ALUGAR_E_INVESTIR" ? "a" : "b"}
    />
  );
}
