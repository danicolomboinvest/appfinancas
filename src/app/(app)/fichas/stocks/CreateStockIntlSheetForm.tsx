"use client";

import { useActionState } from "react";
import { TickerPicker } from "@/components/forms/TickerPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createSheetAction, type SheetFormState } from "../actions";

const initialState: SheetFormState = {};

export function CreateStockIntlSheetForm() {
  const [state, formAction, isPending] = useActionState(createSheetAction, initialState);
  useSuccessToast(isPending, state.error, "Ficha criada com sucesso.");

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="sheetType" value="STOCK_INTL" />
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <TickerPicker
        kinds={["STOCK_INTL"]}
        companyNameField="companyName"
        label="Qual empresa?"
        placeholder="Nome ou código, ex.: Apple"
        required
        className="w-full sm:w-80"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Lendo..." : "Analisar"}
      </Button>
    </Card>
  );
}
