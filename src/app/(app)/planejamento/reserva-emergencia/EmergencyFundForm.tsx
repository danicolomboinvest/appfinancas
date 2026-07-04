"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
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
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
