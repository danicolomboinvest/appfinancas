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
  // Erro "de verdade" bloqueia o formulário; quando vem fallbackUrl junto, a conta já foi
  // criada, só falta a Dani repassar o link manualmente (e-mail falhou), não é uma falha total.
  useSuccessToast(isPending, state.fallbackUrl ? undefined : state.error, state.sent ? "Convite enviado por e-mail." : undefined);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-ink">Criar conta direto (cortesia/VIP)</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Sem passar pelo cadastro: cria a conta e manda um e-mail para a pessoa escolher a própria senha. Ninguém, nem
          você, fica sabendo qual é.
        </p>
      </div>

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {state.fallbackUrl && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
          <p className="text-xs text-ink-muted">Envie este link para a pessoa (por WhatsApp, por exemplo):</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={state.fallbackUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(state.fallbackUrl!);
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
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Criando..." : "Criar conta e enviar convite"}
        </Button>
      </div>
    </Card>
  );
}
