"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { salvarRendaAction, type RendaState } from "../perfil/actions";

const inicial: RendaState = {};

export function FormDaRenda({ renda, dia }: { renda: number | null; dia: number | null }) {
  const [state, acao, pendente] = useActionState(salvarRendaAction, inicial);
  // Fica na tela depois de salvar: o próprio botão diz "Salvo" (14/10/2026).
  const { salvou } = useSuccessToast(pendente, state.error);
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <CurrencyField label="Renda do mês" name="renda" required defaultValue={renda ?? undefined} />
      {/* Quem recebe em outra moeda procurava aqui e não achava (20/10/2026, cliente na Argentina). */}
      <Link href="/configuracoes/moeda" className="-mt-2 self-start text-[13px] font-medium text-ink-muted underline underline-offset-2">
        Recebe em outra moeda? Trocar a moeda
      </Link>
      <Field label="Dia do pagamento" name="dia" type="number" min={1} max={31} required defaultValue={dia ?? ""} placeholder="5" />
      <Button type="submit" disabled={pendente} className="min-h-12 w-full">
        {pendente ? "Salvando…" : salvou ? "Salvo" : "Salvar"}
      </Button>
    </form>
  );
}
