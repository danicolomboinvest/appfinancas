"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { updateProfileAction, type ProfileState } from "./actions";

const initialState: ProfileState = {};

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string | null; email: string; avatarUrl: string | null };
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);
  useSuccessToast(isPending, state.error);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-4 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" defaultValue={defaults.name ?? ""} placeholder="Seu nome" />
        <Field label="E-mail" name="email" type="email" required defaultValue={defaults.email} />
        <Field
          label="URL da foto (opcional)"
          name="avatarUrl"
          defaultValue={defaults.avatarUrl ?? ""}
          placeholder="https://..."
          className="sm:col-span-2"
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
