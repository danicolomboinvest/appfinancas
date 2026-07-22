"use client";

import { useActionState } from "react";
import { SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { updatePreferencesAction, type PreferencesState } from "./actions";

const initialState: PreferencesState = {};

export function PreferencesForm({ defaults }: { defaults: { currency: string; theme: string } }) {
  const [state, formAction, isPending] = useActionState(updatePreferencesAction, initialState);
  useSuccessToast(isPending, state.error);

  return (
    <Card
      as="form"
      action={formAction}
      className="flex flex-col gap-4 p-5"
      key={`${defaults.currency}-${defaults.theme}`}
    >
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField label="Moeda" name="currency" defaultValue={defaults.currency}>
          <option value="BRL">Real (R$)</option>
          <option value="USD">Dólar (US$)</option>
          <option value="EUR">Euro (€)</option>
        </SelectField>
        <SelectField label="Tema" name="theme" defaultValue={defaults.theme}>
          <option value="dark">Escuro</option>
          <option value="light">Claro</option>
        </SelectField>
      </div>
      <p className="text-xs text-ink-faint">
        A preferência de tema é aplicada imediatamente após salvar. O suporte completo a outras moedas chega em uma
        próxima atualização, hoje os valores continuam sendo exibidos em R$.
      </p>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
