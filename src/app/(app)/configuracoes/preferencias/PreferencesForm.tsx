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
      {/* O aviso é a parte mais importante desta tela. Sem ele, alguém troca para euro, vê
          "€ 8.500" onde antes lia "R$ 8.500" e acha que o app converteu o patrimônio. */}
      <div className="rounded-lg bg-surface-2 px-3 py-2.5">
        <p className="text-xs text-ink">
          Trocar a moeda <strong>não converte seus valores</strong>.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Os números continuam exatamente os mesmos — só o símbolo muda. Um lançamento de 3.000 passa a aparecer como
          &quot;€ 3.000&quot; em vez de &quot;R$ 3.000&quot;. Use se você lança seus valores em outra moeda.
        </p>
      </div>
      <p className="text-xs text-ink-faint">Moeda e tema são aplicados assim que você salva.</p>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
