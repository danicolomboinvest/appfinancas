"use client";

import { useActionState } from "react";
import { savePlanningParamsAction, type PlanningParamsState } from "./actions";

const initialState: PlanningParamsState = {};

type Defaults = {
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancyAge?: number | null;
  currentPatrimony?: number;
  monthlyContributionAccumulation?: number;
  accumulationAnnualRate?: number;
  inflationAnnualRate?: number;
  usufructAnnualRate?: number;
  desiredPassiveIncome?: number;
  otherPassiveIncome?: number;
};

export function PlanningParamsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, isPending] = useActionState(savePlanningParamsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Idade atual" name="currentAge" type="number" defaultValue={defaults.currentAge} required />
        <Field label="Idade objetivo (aposentadoria)" name="retirementAge" type="number" defaultValue={defaults.retirementAge} required />
        <Field
          label="Expectativa de vida (opcional)"
          name="lifeExpectancyAge"
          type="number"
          defaultValue={defaults.lifeExpectancyAge ?? undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          label="Valor inicial (R$)"
          name="currentPatrimony"
          type="number"
          step="0.01"
          defaultValue={defaults.currentPatrimony}
          required
        />
        <Field
          label="Aporte mensal médio (R$)"
          name="monthlyContributionAccumulation"
          type="number"
          step="0.01"
          defaultValue={defaults.monthlyContributionAccumulation}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          label="Taxa nominal (a.a., ex.: 0.12)"
          name="accumulationAnnualRate"
          type="number"
          step="0.0001"
          defaultValue={defaults.accumulationAnnualRate}
          required
        />
        <Field
          label="Inflação média (a.a.)"
          name="inflationAnnualRate"
          type="number"
          step="0.0001"
          defaultValue={defaults.inflationAnnualRate}
          required
        />
        <Field
          label="Taxa de usufruto (a.a.)"
          name="usufructAnnualRate"
          type="number"
          step="0.0001"
          defaultValue={defaults.usufructAnnualRate}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          label="Gasto mensal desejado (R$)"
          name="desiredPassiveIncome"
          type="number"
          step="0.01"
          defaultValue={defaults.desiredPassiveIncome}
          required
        />
        <Field
          label="Outras rendas passivas (R$, ex.: aluguel + INSS)"
          name="otherPassiveIncome"
          type="number"
          step="0.01"
          defaultValue={defaults.otherPassiveIncome}
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
