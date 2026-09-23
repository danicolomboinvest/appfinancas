"use client";

import { useActionState } from "react";
import { SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { updatePreferencesAction, type PreferencesState } from "./actions";

const initialState: PreferencesState = {};

export function PreferencesForm({
  defaults,
  podeEscolherModo = true,
}: {
  defaults: { currency: string; theme: string };
  /** Falso quando o tema do perfil já decidiu claro/escuro (todos menos o Padrão). */
  podeEscolherModo?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updatePreferencesAction, initialState);
  useSuccessToast(isPending, state.error);
  const { titulos: t } = useProfileTheme().voz;
  // O negrito fica no meio da frase, então ela vem em três partes.
  const [avisoAntes, avisoForte, avisoDepois] = t.cfgMoedaAviso;

  return (
    <Card
      as="form"
      action={formAction}
      className="flex flex-col gap-4 p-5"
      key={`${defaults.currency}-${defaults.theme}`}
    >
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField label={t.cfgMoeda} name="currency" defaultValue={defaults.currency}>
          <option value="BRL">Real (R$)</option>
          <option value="USD">Dólar (US$)</option>
          <option value="EUR">Euro (€)</option>
          <option value="GBP">Libra (£)</option>
        </SelectField>
        {podeEscolherModo ? (
          <SelectField label={t.cfgTema} name="theme" defaultValue={defaults.theme}>
            <option value="dark">{t.cfgTemaEscuro}</option>
            <option value="light">{t.cfgTemaClaro}</option>
          </SelectField>
        ) : (
          <p className="text-xs text-ink-muted">{t.cfgModoDecididoPeloTema}</p>
        )}
      </div>
      {/* O aviso é a parte mais importante desta tela. Sem ele, alguém troca para euro, vê
          "€ 8.500" onde antes lia "R$ 8.500" e acha que o app converteu o patrimônio. */}
      <div className="rounded-lg bg-surface-2 px-3 py-2.5">
        <p className="text-xs text-ink">
          {avisoAntes}
          <strong>{avisoForte}</strong>
          {avisoDepois}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t.cfgMoedaAvisoTexto1("€ 3.000", "R$ 3.000")}</p>
        <p className="mt-1 text-xs text-ink-muted">{t.cfgMoedaAvisoTexto2}</p>
      </div>
      <p className="text-xs text-ink-faint">{t.cfgAplicadoAoSalvar}</p>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? t.cfgSalvando : t.cfgSalvar}
      </Button>
    </Card>
  );
}
