"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Idade atual" name="currentAge" type="number" defaultValue={defaults.currentAge} required />
        <Field
          label="Idade objetivo (aposentadoria)"
          name="retirementAge"
          type="number"
          defaultValue={defaults.retirementAge}
          required
        />
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

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
