"use client";

import { useActionState } from "react";
import { Field, TextareaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { addEmailsAction, type AccessFormState } from "./actions";

const initialState: AccessFormState = {};

export function AddEmailsForm() {
  const [state, formAction, isPending] = useActionState(addEmailsAction, initialState);
  useSuccessToast(
    isPending,
    state.error,
    state.added ? `${state.added} e-mail${state.added === 1 ? "" : "s"} liberado${state.added === 1 ? "" : "s"}.` : undefined,
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
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Liberando..." : "Liberar acesso"}
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Colar de novo um e-mail que estava desativado reativa o acesso. Duplicados são ignorados.
      </p>
    </Card>
  );
}
