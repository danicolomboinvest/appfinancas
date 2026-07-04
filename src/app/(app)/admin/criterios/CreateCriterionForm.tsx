"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCriterionAction, type CriterionFormState } from "./actions";

const initialState: CriterionFormState = {};

export function CreateCriterionForm() {
  const [state, formAction, isPending] = useActionState(createCriterionAction, initialState);

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <SelectField label="Ficha" id="sheetType" name="sheetType">
        <option value="STOCK">Ações</option>
        <option value="FII">FIIs</option>
      </SelectField>
      <Field label="Chave (única, ex.: novo_criterio)" id="key" name="key" required placeholder="novo_criterio" />
      <Field label="Rótulo" id="label" name="label" required />
      <Field label="Categoria (ex.: Qualitativo, TIJOLO, COMUM)" id="category" name="category" required />
      <Field label="Ordem" id="order" name="order" type="number" required defaultValue={99} className="w-20" />
      <Field label="Onde encontrar os dados (tooltip)" id="helpText" name="helpText" className="w-64" />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Criando..." : "Adicionar critério"}
      </Button>
    </Card>
  );
}
