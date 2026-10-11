import { ehDoCartao } from "@/lib/cartao/limite";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import type { listMonthlyEntries } from "@/lib/repositories/monthly-entry.repo";

type Linha = Awaited<ReturnType<typeof listMonthlyEntries>>[number];

function formatRelativeDay(date: Date | null): string | null {
  if (!date) return null;
  const iso = date.toISOString().slice(0, 10);
  const today = nowInBrazil();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (iso === todayIso) return "Hoje";
  if (iso === yesterdayIso) return "Ontem";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function toDateInput(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}


/** Lançamentos do banco no formato da lista de Transações (mês ou período). */
export function linhasDaLista(entries: Linha[], ocultos: boolean) {
  return entries.map((entry) => ({
    id: entry.id,
    year: entry.year,
    month: entry.month,
    category: entry.category,
    parentCategory: entry.parentCategory,
    customCategoryId: entry.customCategoryId,
    subcategory: entry.subcategory,
    description: entry.description,
    amount: Number(entry.amount),
    entryDate: toDateInput(entry.entryDate),
    dayLabel: formatRelativeDay(entry.entryDate),
    goalId: entry.goalId,
    recurrenceId: entry.recurrenceId,
    pessoa: entry.pessoa,
    doCasal: entry.doCasal,
    noCartao: ehDoCartao(entry),
    ...(entry.originalCurrency && entry.originalAmount !== null && isCurrencyCode(entry.originalCurrency)
      ? {
          // O olho do topo fechado esconde também o valor na moeda de origem.
          originalLabel: ocultos ? "••••" : formatMoney(Number(entry.originalAmount), entry.originalCurrency),
          originalAmount: Number(entry.originalAmount),
          originalCurrency: entry.originalCurrency,
          exchangeRate: entry.exchangeRate === null ? null : Number(entry.exchangeRate),
        }
      : {}),
  }));
}
