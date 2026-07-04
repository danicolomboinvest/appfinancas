"use client";

import { useActionState } from "react";
import { createCriterionAction, type CriterionFormState } from "./actions";

const initialState: CriterionFormState = {};

export function CreateCriterionForm() {
  const [state, formAction, isPending] = useActionState(createCriterionAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="sheetType" className="text-xs">
          Ficha
        </label>
        <select id="sheetType" name="sheetType" className="rounded border border-black/20 px-2 py-1.5 text-sm">
          <option value="STOCK">Ações</option>
          <option value="FII">FIIs</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="key" className="text-xs">
          Chave (única, ex.: novo_criterio)
        </label>
        <input id="key" name="key" required placeholder="novo_criterio" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="label" className="text-xs">
          Rótulo
        </label>
        <input id="label" name="label" required className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-xs">
          Categoria (ex.: Qualitativo, TIJOLO, COMUM)
        </label>
        <input id="category" name="category" required className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="order" className="text-xs">
          Ordem
        </label>
        <input id="order" name="order" type="number" required defaultValue={99} className="w-20 rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="helpText" className="text-xs">
          Onde encontrar os dados (tooltip)
        </label>
        <input id="helpText" name="helpText" className="w-64 rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Criando..." : "Adicionar critério"}
      </button>
    </form>
  );
}
