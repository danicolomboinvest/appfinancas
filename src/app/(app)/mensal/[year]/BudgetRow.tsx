"use client";

import { useActionState } from "react";
import type { ParentCategory } from "@prisma/client";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { saveBudgetAction, type BudgetState } from "./budget-actions";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const initialState: BudgetState = {};

export function BudgetRow({
  year,
  month,
  parentCategory,
  plannedAmount,
  spent,
}: {
  year: number;
  month: number;
  parentCategory: ParentCategory;
  plannedAmount: number;
  spent: number;
}) {
  const [state, formAction, isPending] = useActionState(saveBudgetAction, initialState);
  useSuccessToast(isPending, state.error, "Orçamento atualizado.");

  const percent = plannedAmount > 0 ? spent / plannedAmount : spent > 0 ? 1 : 0;
  const tone = percent >= 1 ? "danger" : percent >= 0.8 ? "accent" : "success";
  const remaining = plannedAmount - spent;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-medium text-ink">{PARENT_CATEGORY_LABEL[parentCategory]}</span>
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="parentCategory" value={parentCategory} />
          <CurrencyField label="Planejado (R$)" name="plannedAmount" defaultValue={plannedAmount} className="w-28" />
          <Button type="submit" size="sm" disabled={isPending} variant="ghost">
            {isPending ? "..." : "Salvar"}
          </Button>
        </form>
      </div>

      <ProgressBar percent={Math.min(percent, 1)} tone={tone} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {formatBRL(spent)} de {formatBRL(plannedAmount)} planejado
        </span>
        <span className={remaining < 0 ? "text-danger" : "text-ink-muted"}>
          {remaining >= 0 ? `Ainda pode gastar ${formatBRL(remaining)}` : `Estourou em ${formatBRL(-remaining)}`}
        </span>
      </div>
    </div>
  );
}
