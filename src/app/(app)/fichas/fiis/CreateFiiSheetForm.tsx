"use client";

import { useActionState } from "react";
import { createSheetAction, type SheetFormState } from "../actions";

const initialState: SheetFormState = {};

const FII_TYPE_OPTIONS = [
  { value: "TIJOLO", label: "Tijolo" },
  { value: "PAPEL", label: "Papel" },
  { value: "HIBRIDO", label: "Híbrido" },
  { value: "FUNDO_DE_FUNDOS", label: "Fundo de Fundos" },
];

export function CreateFiiSheetForm() {
  const [state, formAction, isPending] = useActionState(createSheetAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      <input type="hidden" name="sheetType" value="FII" />
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="ticker" className="text-xs">
          Ticker
        </label>
        <input id="ticker" name="ticker" required placeholder="Ex.: HGLG11" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="companyName" className="text-xs">
          Nome do fundo (opcional)
        </label>
        <input id="companyName" name="companyName" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fiiType" className="text-xs">
          Tipo de FII
        </label>
        <select id="fiiType" name="fiiType" className="rounded border border-black/20 px-2 py-1.5 text-sm">
          {FII_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Criando..." : "Nova ficha"}
      </button>
    </form>
  );
}
