"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { PercentField } from "@/components/ui/PercentField";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { createReferenceRateAction, type ReferenceRateState } from "./actions";

const initialState: ReferenceRateState = {};

/** "Adicionar" (protótipo): nome e taxa ao ano. Vale a partir de hoje. */
export function ReferenceRateForm() {
  const [state, formAction, isPending] = useActionState(createReferenceRateAction, initialState);
  const { titulos: t } = useProfileTheme().voz;
  useSuccessToast(isPending, state.error);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome" id="name" name="name" required placeholder="Ex.: CDB do meu banco" />
      <PercentField label="Taxa (% ao ano)" id="rateValue" name="rateValue" required />
      <input type="hidden" name="basis" value="ANNUAL_252" />
      <input type="hidden" name="effectiveDate" value={new Date().toISOString().slice(0, 10)} />
      <button type="submit" disabled={isPending} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-50">
        {isPending ? t.cfgSalvando : "Adicionar"}
      </button>
    </form>
  );
}
