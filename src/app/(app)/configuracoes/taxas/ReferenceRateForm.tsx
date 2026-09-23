"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { createReferenceRateAction, type ReferenceRateState } from "./actions";

const initialState: ReferenceRateState = {};

export function ReferenceRateForm() {
  const [state, formAction, isPending] = useActionState(createReferenceRateAction, initialState);
  const { titulos: t } = useProfileTheme().voz;
  useSuccessToast(isPending, state.error, t.cfgTaxaAdicionadaToast);

  // Os rótulos das bases vêm da voz do tema, por isso a lista nasce dentro do componente.
  const basisOptions = [
    { value: "ANNUAL_252", label: t.cfgTaxaBaseAnual252 },
    { value: "ANNUAL_365", label: t.cfgTaxaBaseAnual365 },
    { value: "MONTHLY", label: t.cfgTaxaBaseMensal },
  ];

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label={t.cfgTaxaNome} id="name" name="name" required placeholder={t.cfgTaxaNomePlaceholder} />
      <PercentField label={t.cfgTaxaTaxa} id="rateValue" name="rateValue" required />
      <SelectField label={t.cfgTaxaBase} id="basis" name="basis">
        {basisOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Field
        label={t.cfgTaxaVigenteDesde}
        id="effectiveDate"
        name="effectiveDate"
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? t.cfgSalvando : t.cfgTaxaAdicionar}
      </Button>
    </Card>
  );
}
