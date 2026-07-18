"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { fetchStockOverviewAction } from "./actions";
import type { OverviewItem, OverviewSignal } from "@/lib/analysis/stock-overview";

/** Aparência de cada selo. O ponto usa bg-current (herda a cor do texto do selo). */
const SIGNAL: Record<OverviewSignal, { label: string; cls: string }> = {
  favoravel: { label: "Favorável", cls: "bg-success-soft text-success" },
  neutro: { label: "Na média", cls: "bg-surface-2 text-ink-muted" },
  atencao: { label: "Atenção", cls: "bg-danger-soft text-danger" },
};

type OverviewData = { items: OverviewItem[]; counts: Record<OverviewSignal, number>; disclaimer: string };

/**
 * Overview educativo da empresa: carrega sozinho ao abrir a ficha e mostra um selo por
 * indicador (Favorável / Na média / Atenção) com a régua transparente. Não é recomendação.
 */
export function StockOverviewCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setData(null);
    setError(null);
    startTransition(async () => {
      const r = await fetchStockOverviewAction(ticker);
      if (r.ok) setData({ items: r.items, counts: r.counts, disclaimer: r.disclaimer });
      else setError(r.error);
    });
  }, [ticker]);

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">O que os números dizem sobre {ticker.toUpperCase()}</p>
        {data && (
          <span className="text-xs text-ink-muted">
            {data.counts.favoravel} favoráveis · {data.counts.neutro} na média · {data.counts.atencao} atenção
          </span>
        )}
      </div>

      {isPending && !data && !error && <p className="text-sm text-ink-muted">Analisando os indicadores…</p>}
      {error && <p className="text-sm text-ink-muted">{error}</p>}

      {data && (
        <>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {data.items.map((it) => {
              const s = SIGNAL[it.signal];
              return (
                <li key={it.key} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {it.label} <span className="tabular-nums text-ink-muted">{it.value}</span>
                    </p>
                    <p className="text-xs text-ink-faint">{it.reference}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-faint">{data.disclaimer}</p>
        </>
      )}
    </Card>
  );
}
