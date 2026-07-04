"use client";

import { useActionState, useState } from "react";
import { createAssetAction, type AssetFormState } from "./actions";

const initialState: AssetFormState = {};

const ASSET_CLASS_OPTIONS = [
  { value: "RENDA_FIXA", label: "Renda Fixa" },
  { value: "ACAO", label: "Ação" },
  { value: "FII", label: "FII" },
  { value: "TESOURO_DIRETO", label: "Tesouro Direto" },
  { value: "FUNDO", label: "Fundo" },
  { value: "CRIPTO", label: "Cripto" },
  { value: "OUTRO", label: "Outro" },
];

const OBJECTIVE_OPTIONS = [
  { value: "OUTRO", label: "Outro" },
  { value: "RESERVA_EMERGENCIA", label: "Reserva de emergência" },
  { value: "LIBERDADE_FINANCEIRA", label: "Liberdade financeira" },
  { value: "META", label: "Meta" },
];

export function AssetForm({ goals }: { goals: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createAssetAction, initialState);
  const [objective, setObjective] = useState("OUTRO");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-xs">
          Nome
        </label>
        <input id="name" name="name" required placeholder="Ex.: Tesouro Selic 2029" className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ticker" className="text-xs">
          Ticker (opcional)
        </label>
        <input id="ticker" name="ticker" className="w-24 rounded border border-black/20 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="assetClass" className="text-xs">
          Classe
        </label>
        <select id="assetClass" name="assetClass" className="rounded border border-black/20 px-2 py-1.5 text-sm">
          {ASSET_CLASS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="objective" className="text-xs">
          Objetivo
        </label>
        <select
          id="objective"
          name="objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="rounded border border-black/20 px-2 py-1.5 text-sm"
        >
          {OBJECTIVE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {objective === "META" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="goalId" className="text-xs">
            Meta vinculada
          </label>
          <select id="goalId" name="goalId" className="rounded border border-black/20 px-2 py-1.5 text-sm">
            <option value="">Selecione...</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="currentValue" className="text-xs">
          Valor atual (R$)
        </label>
        <input
          id="currentValue"
          name="currentValue"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="idealAllocationPercent" className="text-xs">
          Alocação ideal (ex.: 0.1 = 10%)
        </label>
        <input
          id="idealAllocationPercent"
          name="idealAllocationPercent"
          type="number"
          step="0.001"
          min="0"
          max="1"
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Salvando..." : "Adicionar"}
      </button>
    </form>
  );
}
