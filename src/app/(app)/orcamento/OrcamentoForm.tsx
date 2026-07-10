"use client";

import { useActionState } from "react";
import type { ParentCategory } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { BudgetCategoryCard } from "./BudgetCategoryCard";
import { CustomCategoryBudgetCard } from "./CustomCategoryBudgetCard";
import { NewCustomCategoryCard } from "./NewCustomCategoryCard";
import { applyAllBudgetsAction, type AnnualBudgetState } from "./actions";

const initialState: AnnualBudgetState = {};

export function OrcamentoForm({
  year,
  parentCategories,
  customCategories,
}: {
  year: number;
  parentCategories: { key: ParentCategory; label: string; description: string; defaultValue: number }[];
  customCategories: { id: string; name: string; icon: string; defaultValue: number }[];
}) {
  const [state, formAction, isPending] = useActionState(applyAllBudgetsAction, initialState);
  useSuccessToast(isPending, state.error, "Planejamento salvo para os 12 meses do ano.");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="year" value={year} />

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parentCategories.map((category) => (
          <BudgetCategoryCard
            key={category.key}
            parentCategory={category.key}
            label={category.label}
            description={category.description}
            defaultValue={category.defaultValue}
          />
        ))}
        {customCategories.map((category) => (
          <CustomCategoryBudgetCard
            key={category.id}
            customCategoryId={category.id}
            name={category.name}
            icon={category.icon}
            defaultValue={category.defaultValue}
          />
        ))}
        <NewCustomCategoryCard />
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar tudo"}
      </Button>
    </form>
  );
}
