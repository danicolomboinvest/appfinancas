"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { deleteAccountAction, type DeleteAccountState } from "./delete-account-actions";

const initialState: DeleteAccountState = {};

/** Zona de perigo: exclusão definitiva da conta com dupla confirmação (expandir + senha). */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initialState);
  const { titulos: t } = useProfileTheme().voz;
  // "todos os seus dados" fica em negrito no meio da frase, por isso ela vem em três partes.
  const [textoAntes, textoForte, textoDepois] = t.cfgExcluirContaTexto;

  return (
    <div className="rounded-2xl border border-danger/40 bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-danger">
          <TriangleAlert size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{t.cfgExcluirContaTitulo}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {textoAntes}
            <strong className="text-ink">{textoForte}</strong>
            {textoDepois}
          </p>

          {!open ? (
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
              {t.cfgExcluirContaQuero}
            </Button>
          ) : (
            <form action={formAction} className="mt-4 flex flex-col gap-3">
              {state.error && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
              )}
              <Field
                label={t.cfgExcluirContaSenha}
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isPending} className="bg-danger text-white hover:opacity-90">
                  {isPending ? t.cfgExcluindo : t.cfgExcluirContaBotao}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  {t.cfgCancelar}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
