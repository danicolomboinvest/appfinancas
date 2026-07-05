"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
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
  useSuccessToast(isPending, state.error);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Meses de proteção" name="targetMonths" type="number" defaultValue={defaults.targetMonths} required />
        <CurrencyField
          label="Custo mensal (R$)"
          name="monthlyExpenseBase"
          defaultValue={defaults.monthlyExpenseBase}
          required
        />
        <CurrencyField label="Reserva atual (R$)" name="currentAmount" defaultValue={defaults.currentAmount} />
        <CurrencyField
          label="Aporte mensal (R$)"
          name="monthlyContribution"
          defaultValue={defaults.monthlyContribution}
          required
        />
        <PercentField label="Rentabilidade anual" name="annualRate" defaultValue={defaults.annualRate} required />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
