"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { HelpTooltip } from "@/components/forms/HelpTooltip";
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
  useSuccessToast(isPending, state.error);

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
        <CurrencyField
          label="Valor inicial (R$)"
          name="currentPatrimony"
          defaultValue={defaults.currentPatrimony}
          required
        />
        <CurrencyField
          label="Aporte mensal médio (R$)"
          name="monthlyContributionAccumulation"
          defaultValue={defaults.monthlyContributionAccumulation}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <PercentField
          label="Taxa nominal (a.a.)"
          labelExtra={
            <HelpTooltip text="A rentabilidade anual que você espera obter na fase de acúmulo, antes de descontar a inflação. Ex.: se seus investimentos rendem perto do CDI, use a taxa do CDI." />
          }
          name="accumulationAnnualRate"
          defaultValue={defaults.accumulationAnnualRate}
          required
        />
        <PercentField
          label="Inflação média (a.a.)"
          labelExtra={
            <HelpTooltip text="A inflação anual esperada no longo prazo (ex.: meta do IPCA). Usada para descontar o efeito da inflação e mostrar seu patrimônio em valores de hoje." />
          }
          name="inflationAnnualRate"
          defaultValue={defaults.inflationAnnualRate}
          required
        />
        <PercentField
          label="Taxa na Liberdade Financeira (a.a.)"
          labelExtra={
            <HelpTooltip text="A rentabilidade anual esperada depois de aposentado, na fase de usufruto, geralmente mais conservadora que a taxa de acúmulo, já que você passa a depender desse rendimento para viver." />
          }
          name="usufructAnnualRate"
          defaultValue={defaults.usufructAnnualRate}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CurrencyField
          label="Gasto mensal desejado (R$)"
          name="desiredPassiveIncome"
          defaultValue={defaults.desiredPassiveIncome}
          required
        />
        <CurrencyField
          label="Outras rendas passivas (R$, ex.: aluguel + INSS)"
          name="otherPassiveIncome"
          defaultValue={defaults.otherPassiveIncome}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
