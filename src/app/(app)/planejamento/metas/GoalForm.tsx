"use client";

import { useActionState } from "react";
import { createGoalAction, updateGoalAction, type GoalFormState } from "./actions";

const initialState: GoalFormState = {};

type Defaults = {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
  currentAmount?: number;
  annualRate?: number;
};

export function GoalForm({
  goalId,
  defaults,
  submitLabel,
}: {
  /** Presente = editar meta existente; ausente = criar meta nova. */
  goalId?: string;
  defaults: Defaults;
  submitLabel: string;
}) {
  const action = goalId ? updateGoalAction.bind(null, goalId) : createGoalAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-xs">
          Nome da meta
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={defaults.name}
          placeholder="Ex.: Viagem"
          className="rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="targetAmount" className="text-xs">
          Valor-alvo (R$)
        </label>
        <input
          id="targetAmount"
          name="targetAmount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={defaults.targetAmount}
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="currentAmount" className="text-xs">
          Já guardado (R$)
        </label>
        <input
          id="currentAmount"
          name="currentAmount"
          type="number"
          step="0.01"
          defaultValue={defaults.currentAmount ?? 0}
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="targetDate" className="text-xs">
          Data-alvo
        </label>
        <input
          id="targetDate"
          name="targetDate"
          type="date"
          required
          defaultValue={defaults.targetDate}
          className="rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="annualRate" className="text-xs">
          Rentabilidade anual (ex.: 0.11)
        </label>
        <input
          id="annualRate"
          name="annualRate"
          type="number"
          step="0.0001"
          required
          defaultValue={defaults.annualRate}
          className="w-32 rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={isPending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {isPending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
