"use client";

import { useActionState } from "react";
import { saveEmergencyFundAction, type EmergencyFundState } from "./actions";

const initialState: EmergencyFundState = {};

type Defaults = {
  targetMonths?: number;
  monthlyExpenseBase?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  annualRate?: number;
};

export function EmergencyFundForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, isPending] = useActionState(saveEmergencyFundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Meses de proteção" name="targetMonths" type="number" defaultValue={defaults.targetMonths} required />
        <Field
          label="Custo mensal (R$)"
          name="monthlyExpenseBase"
          type="number"
          step="0.01"
          defaultValue={defaults.monthlyExpenseBase}
          required
        />
        <Field
          label="Reserva atual (R$)"
          name="currentAmount"
          type="number"
          step="0.01"
          defaultValue={defaults.currentAmount}
        />
        <Field
          label="Aporte mensal (R$)"
          name="monthlyContribution"
          type="number"
          step="0.01"
          defaultValue={defaults.monthlyContribution}
          required
        />
        <Field
          label="Rentabilidade anual (ex.: 0.11)"
          name="annualRate"
          type="number"
          step="0.0001"
          defaultValue={defaults.annualRate}
          required
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  step,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type: string;
  step?: string;
  defaultValue?: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="rounded border border-black/20 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
