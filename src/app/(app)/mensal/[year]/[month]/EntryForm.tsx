"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ParentCategory } from "@prisma/client";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { CategoryFields } from "@/components/forms/CategoryFields";
import { createMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

export function EntryForm({
  year,
  month,
  recentSubcategories = {},
  customCategories = [],
  onSuccess,
  layout = "inline",
  defaultDescription,
  defaultAmount,
  defaultCategory,
  defaultParentCategory,
  defaultSubcategory,
}: {
  year: number;
  month: number;
  /** Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe, sugeridas como chips. */
  recentSubcategories?: Partial<Record<ParentCategory, string[]>>;
  /** Categorias personalizadas do usuário, exibidas como chips extras junto das 7 padrão. */
  customCategories?: { id: string; name: string }[];
  /** Chamado quando o lançamento é salvo com sucesso — usado para fechar o modal, por exemplo. */
  onSuccess?: () => void;
  /** "stacked" empilha os campos verticalmente — melhor dentro de um modal estreito. */
  layout?: "inline" | "stacked";
  /** Pré-preenchimento (ex.: vindo do lançamento por voz) — o usuário sempre revisa antes de salvar. */
  defaultDescription?: string;
  defaultAmount?: number;
  defaultCategory?: string;
  defaultParentCategory?: ParentCategory;
  defaultSubcategory?: string;
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
      <label className={`flex items-center gap-2 text-xs text-ink-muted ${stacked ? "w-full" : ""}`}>
        <input type="checkbox" name="repeatMonthly" className="h-3.5 w-3.5 accent-accent" />
        Repetir lançamento todo mês (despesa fixa) até dezembro de {year}
      </label>
      <Button type="submit" disabled={isPending} size="sm" className={stacked ? "w-full" : ""}>
        {isPending ? "Salvando..." : "Lançar"}
      </Button>
    </Card>
  );
}
