"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { inviteUserAction, type InviteFormState } from "./actions";

const initialState: InviteFormState = {};

export function InviteUserForm() {
  const [state, formAction, isPending] = useActionState(inviteUserAction, initialState);
  const [copied, setCopied] = useState(false);
  useSuccessToast(isPending, state.error, undefined);

  const credentials = state.created ? `${state.created.email} / ${state.created.password}` : "";

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-ink">Criar conta direto (cortesia/VIP)</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Sem passar pelo cadastro: você já define a senha da pessoa. Ela pode trocar depois pelo &quot;esqueci minha
          senha&quot; se quiser.
        </p>
      </div>

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {state.created && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
          <p className="text-xs text-ink-muted">Conta criada. Envie o login para a pessoa (por WhatsApp, por exemplo):</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={credentials}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(credentials);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nome" id="invite-name" name="name" className="w-56" placeholder="Maria Silva" />
        <Field label="E-mail" id="invite-email" name="email" type="email" className="w-64" placeholder="maria@email.com" />
        <Field
          label="Senha"
          id="invite-password"
          name="password"
          className="w-48"
          placeholder="Mínimo 8 caracteres"
        />
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Criando..." : "Criar conta"}
        </Button>
      </div>
    </Card>
  );
}
