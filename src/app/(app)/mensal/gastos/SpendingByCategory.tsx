"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { SpendingSlice } from "@/components/charts/SpendingPieChart";
import { PARENT_CATEGORY_ICON, isParentCategoryKey, colorForCategorySlice } from "@/lib/categories";
import { getCategoryTransactionsAction, type CategoryTransaction } from "./actions";
import { useMoney } from "@/components/money/MoneyProvider";

type Period = "semana" | "mes" | "ano";

const PERIOD_LABEL: Record<Period, string> = { semana: "Semana", mes: "Mês", ano: "Ano" };

type NavHrefs = {
  prevMonthHref: string;
  nextMonthHref: string;
  prevYearHref: string;
  nextYearHref: string;
};


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
  previousMonthLabel,
}: {
  selectedYear: number;
  selectedMonth: number;
  week: SpendingSlice[];
  month: SpendingSlice[];
  year: SpendingSlice[];
  initialPeriod?: Period;
  subtitle: Record<Period, string>;
  nav: NavHrefs;
  /** Nome do mês anterior, minúsculo ("agosto"), pra frase de comparação de cada linha. */
  previousMonthLabel: string;
}) {
  const money = useMoney();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CategoryTransaction[]>([]);
  const [isLoading, startTransition] = useTransition();

  const data = period === "semana" ? week : period === "ano" ? year : month;
  const total = data.reduce((soma, slice) => soma + slice.value, 0);
  const prevHref = period === "ano" ? nav.prevYearHref : nav.prevMonthHref;
  const nextHref = period === "ano" ? nav.nextYearHref : nav.nextMonthHref;
  const showArrows = period !== "semana";

  function changePeriod(p: Period) {
    setPeriod(p);
    setOpenCategory(null); // a lista aberta é de outro período, fecha ao trocar
  }

  function handleSelect(slice: SpendingSlice) {
    const category = slice.category;
    if (!category) return;
    if (openCategory === slice.name) {
      setOpenCategory(null);
      return;
    }
    setOpenCategory(slice.name);
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

      {/* Lista, e não rosca: a rosca desta tela era idêntica à do resumo do mês, que está a um
          toque daqui — duas telas mostrando o mesmo desenho. O que só existe aqui é o DETALHE:
          tocar numa categoria e ver os lançamentos que formam aquele valor. Então a lista é a
          tela, e cada linha abre. */}
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Nenhum gasto neste período.</p>
      ) : (
        <>
        {/* A dica UMA vez, aqui. Repetida em cada linha, na segunda já era ruído — e ocupava
            a linha onde cabe o que muda de categoria pra categoria. */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-caption text-ink-faint">Toque numa categoria para abrir os lançamentos</p>
          <p className="shrink-0 text-caption font-semibold tabular-nums text-ink-muted">{money(total, { round: true })}</p>
        </div>
        <ul className="flex flex-col">
          {data
            .filter((slice) => slice.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((slice) => {
              const aberta = openCategory === slice.name;
              const cor = colorForCategorySlice(slice.category);
              const icone =
                slice.category?.kind === "parent" && isParentCategoryKey(slice.category.value)
                  ? PARENT_CATEGORY_ICON[slice.category.value]
                  : Receipt;
              const parcela = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              const comparacao = compareWithPrevious(slice, previousMonthLabel, money);
              return (
                <li key={slice.name} className="border-b border-border/60 last:border-0">
                  <button
                    type="button"
                    onClick={() => handleSelect(slice)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80"
                  >
                    <CategoryIcon icon={icone} color={cor} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold leading-tight text-ink">
                        {slice.name}
                      </span>
                      {comparacao && (
                        <span className={`mt-0.5 block text-caption ${comparacao.tone}`}>{comparacao.text}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[17px] font-semibold leading-tight tabular-nums text-ink">
                        {money(slice.value, { round: true })}
                      </span>
                      <span className="mt-0.5 block text-caption tabular-nums text-ink-muted">{parcela}%</span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-ink-faint transition-transform ${aberta ? "rotate-180" : ""}`}
                    />
                  </button>

                  {aberta && (
                    <div className="pb-3 pl-[3.5rem]">
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
                                {formatDay(t.date) && (
                                  <p className="text-caption tabular-nums text-ink-faint">{formatDay(t.date)}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-medium tabular-nums text-danger">
                                − {money(t.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        </>
      )}
    </div>
  );
}

/**
 * A segunda linha de cada categoria: o que mudou em relação ao mês anterior. Só existe na
 * visão de mês (semana e ano não têm "anterior" comparável) e some quando a diferença é
 * pequena demais pra valer uma frase — silêncio é melhor que "R$ 3 a mais".
 */
function compareWithPrevious(
  slice: SpendingSlice,
  previousMonthLabel: string,
  money: ReturnType<typeof useMoney>,
): { text: string; tone: string } | null {
  if (slice.previousValue === undefined) return null;
  if (slice.previousValue === 0) return { text: `Não teve gasto em ${previousMonthLabel}`, tone: "text-ink-muted" };
  const diff = slice.value - slice.previousValue;
  if (Math.abs(diff) < Math.max(20, slice.previousValue * 0.05)) {
    return { text: `Igual a ${previousMonthLabel}`, tone: "text-ink-muted" };
  }
  return diff > 0
    ? { text: `${money(diff, { round: true })} a mais que em ${previousMonthLabel}`, tone: "text-danger" }
    : { text: `${money(-diff, { round: true })} a menos que em ${previousMonthLabel}`, tone: "text-success" };
}
