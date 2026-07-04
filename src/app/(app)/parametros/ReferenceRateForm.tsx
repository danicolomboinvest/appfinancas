"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createReferenceRateAction, type ReferenceRateState } from "./actions";

const initialState: ReferenceRateState = {};

const BASIS_OPTIONS = [
  { value: "ANNUAL_252", label: "Anual (base 252 dias úteis)" },
  { value: "ANNUAL_365", label: "Anual (base 365 dias)" },
  { value: "MONTHLY", label: "Mensal" },
];

export function ReferenceRateForm() {
  const [state, formAction, isPending] = useActionState(createReferenceRateAction, initialState);

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome" id="name" name="name" required placeholder="Ex.: CDI" />
      <Field label="Taxa (ex.: 0.12 = 12%)" id="rateValue" name="rateValue" type="number" step="0.000001" required className="w-32" />
      <SelectField label="Base" id="basis" name="basis">
        {BASIS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Field
        label="Vigente desde"
        id="effectiveDate"
        name="effectiveDate"
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : "Adicionar"}
      </Button>
    </Card>
  );
}
