"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SpendingPieChart, type SpendingSlice } from "@/components/charts/SpendingPieChart";
import { PARENT_CATEGORY_ICON, isParentCategoryKey, colorForCategorySlice } from "@/lib/categories";
import { getCategoryTransactionsAction, type CategoryTransaction } from "./actions";

type Period = "semana" | "mes" | "ano";

const PERIOD_LABEL: Record<Period, string> = { semana: "Semana", mes: "Mês", ano: "Ano" };

type NavHrefs = {
  prevMonthHref: string;
  nextMonthHref: string;
  prevYearHref: string;
  nextYearHref: string;
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDay(iso: string | null) {
  if (!iso) return null;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Tela "Só gastos": pizza de gastos por categoria com um toggle Semana / Mês / Ano.
 * A troca de aba é instantânea (os três conjuntos já vêm do servidor); as setas ‹ › navegam
 * para outro mês/ano via URL. Clicar numa categoria da legenda abre os lançamentos que a compõem.
 */
export function SpendingByCategory({
  selectedYear,
  selectedMonth,
  week,
  month,
  year,
  initialPeriod = "mes",
  subtitle,
  nav,
}: {
  selectedYear: number;
  selectedMonth: number;
  week: SpendingSlice[];
  month: SpendingSlice[];
  year: SpendingSlice[];
  initialPeriod?: Period;
  subtitle: Record<Period, string>;
  nav: NavHrefs;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openCategoryRef, setOpenCategoryRef] = useState<SpendingSlice["category"] | null>(null);
  const [transactions, setTransactions] = useState<CategoryTransaction[]>([]);
  const [isLoading, startTransition] = useTransition();

  // Ícone + cor da categoria aberta (assinatura visual do documento de referência) — categorias
  // personalizadas não têm o ícone escolhido disponível aqui, então usam um ícone genérico;
  // a cor, essa sim, é sempre a certa (mesmo hash usado no resto do app).
  const openIcon =
    openCategoryRef?.kind === "parent" && isParentCategoryKey(openCategoryRef.value)
      ? PARENT_CATEGORY_ICON[openCategoryRef.value]
      : Receipt;
  const openColor = colorForCategorySlice(openCategoryRef ?? undefined);

  const data = period === "semana" ? week : period === "ano" ? year : month;
  const prevHref = period === "ano" ? nav.prevYearHref : nav.prevMonthHref;
  const nextHref = period === "ano" ? nav.nextYearHref : nav.nextMonthHref;
  const showArrows = period !== "semana";

  function changePeriod(p: Period) {
    setPeriod(p);
    setOpenCategory(null); // a lista aberta é de outro período — fecha ao trocar
  }

  function handleSelect(slice: SpendingSlice) {
    const category = slice.category;
    if (!category) return;
    if (openCategory === slice.name) {
      setOpenCategory(null);
      setOpenCategoryRef(null);
      return;
    }
    setOpenCategory(slice.name);
    setOpenCategoryRef(slice.category ?? null);
    startTransition(async () => {
      const txns = await getCategoryTransactionsAction(period, selectedYear, selectedMonth, category);
      setTransactions(txns);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <div className="inline-flex gap-1 rounded-full border border-border bg-surface-2 p-1">
          {(["semana", "mes", "ano"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePeriod(p)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                period === p ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

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
        <SpendingPieChart data={data} onSelect={handleSelect} selectedName={openCategory} />

        {/* Lançamentos da categoria clicada — expande dentro do card. */}
        {openCategory && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2.5">
              <CategoryIcon icon={openIcon} color={openColor} size={36} />
              <p className="text-xs font-medium text-ink-muted">
                Lançamentos em <span className="text-ink">{openCategory}</span>
              </p>
            </div>
            {isLoading ? (
              <p className="text-sm text-ink-faint">Carregando…</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhum lançamento neste período.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{t.description}</p>
                      {formatDay(t.date) && <p className="text-caption tabular-nums text-ink-faint">{formatDay(t.date)}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-danger">− {formatBRL(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
