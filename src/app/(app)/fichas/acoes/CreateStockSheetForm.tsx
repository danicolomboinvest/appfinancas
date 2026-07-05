"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createSheetAction, type SheetFormState } from "../actions";

const initialState: SheetFormState = {};

export function CreateStockSheetForm() {
  const [state, formAction, isPending] = useActionState(createSheetAction, initialState);
  useSuccessToast(isPending, state.error, "Ficha criada com sucesso.");

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="sheetType" value="STOCK" />
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Ticker" id="ticker" name="ticker" required placeholder="Ex.: PETR4" />
      <Field label="Empresa (opcional)" id="companyName" name="companyName" />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Criando..." : "Nova ficha"}
      </Button>
    </Card>
  );
}
