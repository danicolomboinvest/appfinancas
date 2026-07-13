"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SpendingPieChart, type SpendingSlice } from "@/components/charts/SpendingPieChart";

type Period = "semana" | "mes" | "ano";

const PERIOD_LABEL: Record<Period, string> = { semana: "Semana", mes: "Mês", ano: "Ano" };

type NavHrefs = {
  prevMonthHref: string;
  nextMonthHref: string;
  prevYearHref: string;
  nextYearHref: string;
};

/**
 * Tela "Só gastos": pizza de gastos por categoria com um toggle Semana / Mês / Ano.
 * A troca de aba é instantânea (os três conjuntos já vêm do servidor); as setas ‹ ›
 * navegam para outro mês/ano via URL (?year&month), recalculando no servidor.
 */
export function SpendingByCategory({
  week,
  month,
  year,
  initialPeriod = "mes",
  subtitle,
  nav,
}: {
  week: SpendingSlice[];
  month: SpendingSlice[];
  year: SpendingSlice[];
  initialPeriod?: Period;
  /** Rótulo do período mostrado abaixo do toggle (ex.: "Julho de 2026"). */
  subtitle: Record<Period, string>;
  nav: NavHrefs;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const data = period === "semana" ? week : period === "ano" ? year : month;

  const prevHref = period === "ano" ? nav.prevYearHref : nav.prevMonthHref;
  const nextHref = period === "ano" ? nav.nextYearHref : nav.nextMonthHref;
  const showArrows = period !== "semana"; // "últimos 7 dias" é sempre relativo a hoje

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

      {/* Seletor de período: setas mudam o mês (ou o ano, na aba Ano) via servidor. */}
      <div className="flex items-center justify-center gap-1">
        {showArrows ? (
          <>
            <Link
              href={prevHref}
              aria-label="Período anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={18} />
            </Link>
            <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink">{subtitle[period]}</span>
            <Link
              href={nextHref}
              aria-label="Próximo período"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight size={18} />
            </Link>
          </>
        ) : (
          <span className="text-caption text-ink-muted">{subtitle[period]}</span>
        )}
      </div>

      <Card className="p-5">
        <SpendingPieChart data={data} />
      </Card>
    </div>
  );
}
