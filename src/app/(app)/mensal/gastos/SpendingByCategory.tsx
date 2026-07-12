"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { SpendingPieChart, type SpendingSlice } from "@/components/charts/SpendingPieChart";

type Period = "semana" | "mes" | "ano";

const PERIOD_LABEL: Record<Period, string> = { semana: "Semana", mes: "Mês", ano: "Ano" };

/**
 * Tela "Só gastos": pizza de gastos por categoria com um toggle Semana / Mês / Ano. Os três
 * conjuntos já vêm calculados do servidor, então a troca é instantânea (sem recarregar).
 */
export function SpendingByCategory({
  week,
  month,
  year,
  subtitle,
}: {
  week: SpendingSlice[];
  month: SpendingSlice[];
  year: SpendingSlice[];
  /** Rótulo do período mostrado abaixo do toggle (ex.: "Julho de 2026"). */
  subtitle: Record<Period, string>;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const data = period === "semana" ? week : period === "ano" ? year : month;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <div className="inline-flex gap-1 rounded-full border border-border bg-surface-2 p-1">
          {(["semana", "mes", "ano"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                period === p ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-caption text-ink-muted">{subtitle[period]}</p>

      <Card className="p-5">
        <SpendingPieChart data={data} />
      </Card>
    </div>
  );
}
