"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createSheetAction, type SheetFormState } from "../actions";

const initialState: SheetFormState = {};

const FII_TYPE_OPTIONS = [
  { value: "TIJOLO", label: "Tijolo" },
  { value: "PAPEL", label: "Papel" },
  { value: "HIBRIDO", label: "Híbrido" },
  { value: "FUNDO_DE_FUNDOS", label: "Fundo de Fundos" },
];

export function CreateFiiSheetForm() {
  const [state, formAction, isPending] = useActionState(createSheetAction, initialState);
  useSuccessToast(isPending, state.error, "Ficha criada com sucesso.");

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="sheetType" value="FII" />
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Ticker" id="ticker" name="ticker" required placeholder="Ex.: HGLG11" />
      <Field label="Nome do fundo (opcional)" id="companyName" name="companyName" />
      <SelectField label="Tipo de FII" id="fiiType" name="fiiType">
        {FII_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Criando..." : "Nova ficha"}
      </Button>
    </Card>
  );
}
