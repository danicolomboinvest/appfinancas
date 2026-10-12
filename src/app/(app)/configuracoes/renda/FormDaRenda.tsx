"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useCurrency } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { salvarRendaAction, type RendaState } from "../perfil/actions";

const inicial: RendaState = {};

export function FormDaRenda({ renda, dia }: { renda: number | null; dia: number | null }) {
  const [state, acao, pendente] = useActionState(salvarRendaAction, inicial);
  useSuccessToast(pendente, state.error);
  const moeda = useCurrency();
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label={`Renda do mês (${currencySymbol(moeda)})`} name="renda" inputMode="decimal" required defaultValue={renda ? String(renda).replace(".", ",") : ""} placeholder="0" />
      <Field label="Dia do pagamento" name="dia" type="number" min={1} max={31} required defaultValue={dia ?? ""} placeholder="5" />
      <Button type="submit" disabled={pendente} className="min-h-12 w-full">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
