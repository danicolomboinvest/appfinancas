"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { deleteAccountAction, type DeleteAccountState } from "./delete-account-actions";

const initialState: DeleteAccountState = {};

/** Zona de perigo: exclusão definitiva da conta com dupla confirmação (expandir + senha). */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initialState);

  return (
    <div className="rounded-2xl border border-danger/40 bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-danger">
          <TriangleAlert size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Excluir minha conta</p>
          <p className="mt-1 text-sm text-ink-muted">
            Apaga a conta e <strong className="text-ink">todos os seus dados</strong> (lançamentos, orçamentos, metas,
            carteira) de forma definitiva. Não tem volta, se quiser guardar algo, exporte antes.
          </p>

          {!open ? (
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
              Quero excluir minha conta
            </Button>
          ) : (
            <form action={formAction} className="mt-4 flex flex-col gap-3">
              {state.error && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
              )}
              <Field
                label="Digite sua senha para confirmar"
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isPending} className="bg-danger text-white hover:opacity-90">
                  {isPending ? "Excluindo..." : "Excluir tudo definitivamente"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
