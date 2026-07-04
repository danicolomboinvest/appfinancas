"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome da meta" id="name" name="name" required defaultValue={defaults.name} placeholder="Ex.: Viagem" />
      <Field
        label="Valor-alvo (R$)"
        id="targetAmount"
        name="targetAmount"
        type="number"
        step="0.01"
        min="0.01"
        required
        defaultValue={defaults.targetAmount}
        className="w-32"
      />
      <Field
        label="Já guardado (R$)"
        id="currentAmount"
        name="currentAmount"
        type="number"
        step="0.01"
        defaultValue={defaults.currentAmount ?? 0}
        className="w-32"
      />
      <Field label="Data-alvo" id="targetDate" name="targetDate" type="date" required defaultValue={defaults.targetDate} />
      <Field
        label="Rentabilidade anual (ex.: 0.11)"
        id="annualRate"
        name="annualRate"
        type="number"
        step="0.0001"
        required
        defaultValue={defaults.annualRate}
        className="w-32"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </Card>
  );
}
