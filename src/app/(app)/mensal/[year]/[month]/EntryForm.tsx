"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

const CATEGORY_OPTIONS = [
  { value: "INCOME", label: "Renda" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INVESTMENT_CONTRIBUTION", label: "Aporte" },
];

export function EntryForm({
  year,
  month,
  onSuccess,
  layout = "inline",
}: {
  year: number;
  month: number;
  /** Chamado quando o lançamento é salvo com sucesso — usado para fechar o modal, por exemplo. */
  onSuccess?: () => void;
  /** "stacked" empilha os campos verticalmente — melhor dentro de um modal estreito. */
  layout?: "inline" | "stacked";
}) {
  const [state, formAction, isPending] = useActionState(createMonthlyEntryAction, initialState);
  const wasPending = useRef(false);
  useSuccessToast(isPending, state.error, "Lançamento salvo com sucesso.");

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  const stacked = layout === "stacked";

  return (
    <Card
      as="form"
      action={formAction}
      className={stacked ? "flex flex-col gap-3 p-4" : "flex flex-wrap items-end gap-3 p-4"}
    >
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <SelectField label="Categoria" id="category" name="category" className={stacked ? "w-full" : ""}>
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Field label="Subcategoria" id="subcategory" name="subcategory" placeholder="Ex.: Salário" className={stacked ? "w-full" : ""} />
      <Field label="Descrição" id="description" name="description" className={stacked ? "w-full" : ""} />
      <CurrencyField label="Valor (R$)" id="amount" name="amount" required className={stacked ? "" : "w-32"} />
      <Button type="submit" disabled={isPending} size="sm" className={stacked ? "w-full" : ""}>
        {isPending ? "Salvando..." : "Lançar"}
      </Button>
    </Card>
  );
}
