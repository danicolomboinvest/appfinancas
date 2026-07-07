"use client";

import { useActionState, useState } from "react";
import type { ParentCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { PARENT_CATEGORY_ICON } from "@/lib/categories";
import { applyBudgetToWholeYearAction, type AnnualBudgetState } from "./actions";

const initialState: AnnualBudgetState = {};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BudgetCategoryCard({
  year,
  parentCategory,
  label,
  description,
  defaultValue,
}: {
  year: number;
  parentCategory: ParentCategory;
  label: string;
  description: string;
  defaultValue: number;
}) {
  const [state, formAction, isPending] = useActionState(applyBudgetToWholeYearAction, initialState);
  useSuccessToast(isPending, state.error, "Planejamento salvo para os 12 meses do ano.");
  const [monthly, setMonthly] = useState(defaultValue);
  const Icon = PARENT_CATEGORY_ICON[parentCategory];

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-4 p-5">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="parentCategory" value={parentCategory} />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-faint">{description}</p>
        </div>
      </div>

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}

      <CurrencyField
        label="Quanto pretende gastar por mês?"
        name="plannedAmount"
        defaultValue={defaultValue}
        onValueChange={setMonthly}
      />

      <p className="text-xs text-ink-muted">
        = <span className="font-medium text-ink">{formatBRL(monthly * 12)}</span> por ano
      </p>

      <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
