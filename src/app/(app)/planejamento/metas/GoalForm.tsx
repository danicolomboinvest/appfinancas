"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { MonthYearField } from "@/components/ui/MonthYearField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
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
  useSuccessToast(isPending, state.error, goalId ? "Meta atualizada com sucesso." : "Meta criada com sucesso.");

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome da meta" id="name" name="name" required defaultValue={defaults.name} placeholder="Ex.: Viagem" />
      <CurrencyField
        label="Valor-alvo (R$)"
        id="targetAmount"
        name="targetAmount"
        required
        defaultValue={defaults.targetAmount}
      />
      <CurrencyField
        label="Já guardado (R$)"
        id="currentAmount"
        name="currentAmount"
        defaultValue={defaults.currentAmount ?? 0}
      />
      <MonthYearField label="Mês/ano alvo" id="targetDate" name="targetDate" required defaultValue={defaults.targetDate} />
      <PercentField label="Rentabilidade anual" id="annualRate" name="annualRate" required defaultValue={defaults.annualRate} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </Card>
  );
}
