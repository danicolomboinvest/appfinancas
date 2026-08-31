"use client";

import { useActionState, useState } from "react";
import { Field, TextareaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { addEmailsAction, type AccessFormState } from "./actions";
import { toDateInputValue, plusOneYear } from "./date-utils";

const initialState: AccessFormState = {};

export function AddEmailsForm() {
  const [state, formAction, isPending] = useActionState(addEmailsAction, initialState);
  const [expiresAt, setExpiresAt] = useState("");
  useSuccessToast(
    isPending,
    state.error,
    state.added
      ? `${state.added} e-mail${state.added === 1 ? "" : "s"} liberado${state.added === 1 ? "" : "s"}.` +
          (state.emailed ? ` ${state.emailed} convite${state.emailed === 1 ? "" : "s"} enviado${state.emailed === 1 ? "" : "s"} por e-mail.` : "")
      : undefined,
  );

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-3 p-4">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <TextareaField
        label="E-mails liberados (um por linha, ou separados por vírgula)"
        id="emails"
        name="emails"
        rows={5}
        placeholder={"maria@email.com\njoao@email.com\nana@email.com"}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Anotação (opcional, ex.: Turma 1)"
          id="note"
          name="note"
          className="w-56"
          placeholder="Turma 1"
        />
        <Field
          label="Acesso até (opcional)"
          id="expiresAt"
          name="expiresAt"
          type="date"
          className="w-40"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setExpiresAt(toDateInputValue(plusOneYear(new Date())))}
        >
          +1 ano
        </Button>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Liberando..." : "Liberar acesso"}
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Colar de novo um e-mail que estava desativado reativa o acesso. Duplicados são ignorados. Deixe &quot;Acesso
        até&quot; em branco pra liberar sem prazo.
      </p>
    </Card>
  );
}
