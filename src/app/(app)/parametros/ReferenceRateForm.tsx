"use client";

import { useActionState } from "react";
import { createReferenceRateAction, type ReferenceRateState } from "./actions";

const initialState: ReferenceRateState = {};

const BASIS_OPTIONS = [
  { value: "ANNUAL_252", label: "Anual (base 252 dias úteis)" },
  { value: "ANNUAL_365", label: "Anual (base 365 dias)" },
  { value: "MONTHLY", label: "Mensal" },
];

export function ReferenceRateForm() {
  const [state, formAction, isPending] = useActionState(createReferenceRateAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-xs">
          Nome
        </label>
        <input id="name" name="name" required placeholder="Ex.: CDI" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rateValue" className="text-xs">
          Taxa (ex.: 0.12 = 12%)
        </label>
        <input
          id="rateValue"
          name="rateValue"
          type="number"
          step="0.000001"
          required
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="basis" className="text-xs">
          Base
        </label>
        <select id="basis" name="basis" className="rounded border border-black/20 px-2 py-1.5 text-sm">
          {BASIS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="effectiveDate" className="text-xs">
          Vigente desde
        </label>
        <input
          id="effectiveDate"
          name="effectiveDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Salvando..." : "Adicionar"}
      </button>
    </form>
  );
}
