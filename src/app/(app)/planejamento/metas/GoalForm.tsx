"use client";

import { useActionState, useState } from "react";
import type { GoalIcon } from "@prisma/client";
import { Plane, Home, Car, PiggyBank, Target } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { MonthYearField } from "@/components/ui/MonthYearField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createGoalAction, updateGoalAction, type GoalFormState } from "./actions";

const initialState: GoalFormState = {};

const ICON_OPTIONS: { value: GoalIcon; label: string; Icon: typeof Target }[] = [
  { value: "VIAGEM", label: "Viagem", Icon: Plane },
  { value: "CASA", label: "Casa", Icon: Home },
  { value: "CARRO", label: "Carro", Icon: Car },
  { value: "APOSENTADORIA", label: "Aposentadoria", Icon: PiggyBank },
  { value: "GENERICO", label: "Genérico", Icon: Target },
];

function GoalIconPicker({ defaultValue = "GENERICO" }: { defaultValue?: GoalIcon }) {
  const [icon, setIcon] = useState<GoalIcon>(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">Ícone</span>
      <div className="flex gap-1.5">
        {ICON_OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setIcon(value)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              icon === value
                ? "border-gold bg-gold-soft text-gold-strong"
                : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <input type="hidden" name="icon" value={icon} />
    </div>
  );
}

type Defaults = {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
  currentAmount?: number;
  annualRate?: number;
  icon?: GoalIcon;
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
      <GoalIconPicker defaultValue={defaults.icon} />
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
