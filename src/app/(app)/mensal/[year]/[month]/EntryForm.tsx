"use client";

import { useActionState } from "react";
import { createMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

const CATEGORY_OPTIONS = [
  { value: "INCOME", label: "Renda" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INVESTMENT_CONTRIBUTION", label: "Aporte" },
];

export function EntryForm({ year, month }: { year: number; month: number }) {
  const [state, formAction, isPending] = useActionState(createMonthlyEntryAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-xs">
          Categoria
        </label>
        <select id="category" name="category" className="rounded border border-black/20 px-2 py-1.5 text-sm">
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="subcategory" className="text-xs">
          Subcategoria
        </label>
        <input id="subcategory" name="subcategory" placeholder="Ex.: Salário" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-xs">
          Descrição
        </label>
        <input id="description" name="description" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-xs">
          Valor (R$)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Salvando..." : "Lançar"}
      </button>
    </form>
  );
}
