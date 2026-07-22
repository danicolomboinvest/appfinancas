"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ParentCategory } from "@prisma/client";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { CategoryFields } from "@/components/forms/CategoryFields";
import { createMonthlyEntryAction, updateMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

/** "YYYY-MM-DD" local (não usar toISOString, vira UTC e pode voltar um dia). */
function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function EntryForm({
  year,
  month,
  recentSubcategories = {},
  customCategories = [],
  goals = [],
  onSuccess,
  layout = "inline",
  entryId,
  defaultDescription,
  defaultAmount,
  defaultCategory,
  defaultParentCategory,
  defaultSubcategory,
  defaultEntryDate,
  defaultGoalId,
}: {
  year: number;
  month: number;
  /** Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe, sugeridas como chips. */
  recentSubcategories?: Partial<Record<ParentCategory, string[]>>;
  /** Categorias personalizadas do usuário, exibidas como chips extras junto das 7 padrão. */
  customCategories?: { id: string; name: string }[];
  /** Metas do usuário, permite vincular um aporte à meta ("Aportar pra viagem"). */
  goals?: { id: string; name: string }[];
  /** Chamado quando o lançamento é salvo com sucesso, usado para fechar o modal, por exemplo. */
  onSuccess?: () => void;
  /** "stacked" empilha os campos verticalmente, melhor dentro de um modal estreito. */
  layout?: "inline" | "stacked";
  /** Presente = modo edição: salva por update em vez de criar um novo. */
  entryId?: string;
  /** Pré-preenchimento (ex.: vindo do lançamento por voz), o usuário sempre revisa antes de salvar. */
  defaultDescription?: string;
  defaultAmount?: number;
  defaultCategory?: string;
  defaultParentCategory?: ParentCategory;
  defaultSubcategory?: string;
  defaultEntryDate?: string;
  defaultGoalId?: string;
}) {
  const isEditing = Boolean(entryId);
  const [state, formAction, isPending] = useActionState(
    isEditing ? updateMonthlyEntryAction : createMonthlyEntryAction,
    initialState,
  );
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
      {entryId && <input type="hidden" name="entryId" value={entryId} />}
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <CategoryFields
        recentSubcategories={recentSubcategories}
        customCategories={customCategories}
        stacked={stacked}
        defaultCategory={defaultCategory}
        defaultParentCategory={defaultParentCategory}
        defaultSubcategory={defaultSubcategory}
      />
      <Field
        label="Descrição"
        id="description"
        name="description"
        defaultValue={defaultDescription}
        className={stacked ? "w-full" : ""}
      />
      <CurrencyField
        label="Valor (R$)"
        id="amount"
        name="amount"
        defaultValue={defaultAmount}
        required
        className={stacked ? "" : "w-32"}
      />
      <Field
        label="Data"
        id="entryDate"
        name="entryDate"
        type="date"
        defaultValue={defaultEntryDate ?? toDateInputValue(new Date())}
        className={stacked ? "w-full" : "w-36"}
      />
      {goals.length > 0 && (
        <label className={`flex flex-col gap-1.5 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">Meta vinculada (opcional)</span>
          <select
            name="goalId"
            defaultValue={defaultGoalId ?? ""}
            className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">Nenhuma</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!isEditing && (
        <label className={`flex items-center gap-2 text-xs text-ink-muted ${stacked ? "w-full" : ""}`}>
          <input type="checkbox" name="repeatMonthly" className="h-3.5 w-3.5 accent-accent" />
          Repetir lançamento todo mês (despesa fixa) até dezembro de {year}
        </label>
      )}
      <Button type="submit" disabled={isPending} size="sm" className={stacked ? "w-full" : ""}>
        {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Lançar"}
      </Button>
    </Card>
  );
}
