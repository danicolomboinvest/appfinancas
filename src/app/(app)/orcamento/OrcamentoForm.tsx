"use client";

import { useActionState } from "react";
import type { ParentCategory } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { BudgetCategoryCard } from "./BudgetCategoryCard";
import { CustomCategoryBudgetCard } from "./CustomCategoryBudgetCard";
import { NewCustomCategoryCard } from "./NewCustomCategoryCard";
import { applyAllBudgetsAction, type AnnualBudgetState } from "./actions";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";

const initialState: AnnualBudgetState = {};

export function OrcamentoForm({
  year,
  parentCategories,
  customCategories,
  plan,
}: {
  year: number;
  parentCategories: { key: ParentCategory; label: string; description: string; defaultValue: number }[];
  customCategories: { id: string; name: string; icon: string; defaultValue: number }[];
  /** Renda e aporte já planejados pro ano, pra o formulário abrir preenchido. */
  plan: { plannedIncome: number; plannedInvestment: number };
}) {
  const [state, formAction, isPending] = useActionState(applyAllBudgetsAction, initialState);
  useSuccessToast(isPending, state.error, "Planejamento salvo para os 12 meses do ano.");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="year" value={year} />

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {/* Planejar não é só decidir o que gastar: é decidir quanto entra, quanto sai e quanto
          fica guardado. Renda e aporte vêm ANTES das categorias porque é dessa ordem que a
          conta nasce — primeiro o que entra, depois como ele se divide. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-2 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Quanto você espera ganhar</p>
            <p className="mt-0.5 text-caption text-ink-muted">Sua renda média por mês.</p>
          </div>
          <CurrencyField label="Renda por mês" id="plannedIncome" name="plannedIncome" defaultValue={plan.plannedIncome} />
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Quanto pretende guardar</p>
            <p className="mt-0.5 text-caption text-ink-muted">O aporte que você quer fazer todo mês.</p>
          </div>
          <CurrencyField
            label="Aporte por mês"
            id="plannedInvestment"
            name="plannedInvestment"
            defaultValue={plan.plannedInvestment}
          />
        </Card>
      </div>

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
