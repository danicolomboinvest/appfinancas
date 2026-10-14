"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { salvarRendaAction, type RendaState } from "../perfil/actions";

const inicial: RendaState = {};

export function FormDaRenda({ renda, dia }: { renda: number | null; dia: number | null }) {
  const [state, acao, pendente] = useActionState(salvarRendaAction, inicial);
  useSuccessToast(pendente, state.error);
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <CurrencyField label="Renda do mês" name="renda" required defaultValue={renda ?? undefined} />
      <Field label="Dia do pagamento" name="dia" type="number" min={1} max={31} required defaultValue={dia ?? ""} placeholder="5" />
      <Button type="submit" disabled={pendente} className="min-h-12 w-full">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
