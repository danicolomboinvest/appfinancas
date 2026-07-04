"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

const CATEGORY_OPTIONS = [
  { value: "INCOME", label: "Renda" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INVESTMENT_CONTRIBUTION", label: "Aporte" },
];

export function EntryForm({ year, month }: { year: number; month: number }) {
  const [state, formAction, isPending] = useActionState(createMonthlyEntryAction, initialState);

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <SelectField label="Categoria" id="category" name="category">
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Field label="Subcategoria" id="subcategory" name="subcategory" placeholder="Ex.: Salário" />
      <Field label="Descrição" id="description" name="description" />
      <Field
        label="Valor (R$)"
        id="amount"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        required
        className="w-32"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : "Lançar"}
      </Button>
    </Card>
  );
}
