"use client";

import { useActionState } from "react";
import { createSheetAction, type SheetFormState } from "../actions";

const initialState: SheetFormState = {};

export function CreateStockSheetForm() {
  const [state, formAction, isPending] = useActionState(createSheetAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      <input type="hidden" name="sheetType" value="STOCK" />
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="ticker" className="text-xs">
          Ticker
        </label>
        <input id="ticker" name="ticker" required placeholder="Ex.: PETR4" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="companyName" className="text-xs">
          Empresa (opcional)
        </label>
        <input id="companyName" name="companyName" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Criando..." : "Nova ficha"}
      </button>
    </form>
  );
}
