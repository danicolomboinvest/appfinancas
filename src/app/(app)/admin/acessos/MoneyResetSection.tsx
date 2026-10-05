"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { addMoneyResetAction, toggleMoneyResetAction, type ProductFormState } from "./actions";

type Liberacao = { id: string; email: string; origem: string; ativo: boolean; createdAt: Date };

const dataFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const initialState: ProductFormState = {};

/** Quem tem o Money Reset: as compras da Hubla entram sozinhas; aqui dá pra liberar na mão. */
export function MoneyResetSection({ liberacoes }: { liberacoes: Liberacao[] }) {
  const [state, formAction, isPending] = useActionState(addMoneyResetAction, initialState);
  useSuccessToast(isPending, state.error, state.ok ? "Money Reset liberado." : undefined);
  const ativos = liberacoes.filter((l) => l.ativo).length;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm font-medium text-ink">Money Reset</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {ativos} com acesso. Compra do produto marcado &ldquo;Money Reset&rdquo; na Hubla libera sozinha; reembolso tira. Quem
          não tem nunca vê o Money Reset no app.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
        <label className="flex w-72 flex-col gap-1.5 text-xs font-medium text-ink-muted">
          Liberar na mão (e-mail da conta)
          <input
            name="emails"
            placeholder="email@exemplo.com"
            className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </label>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Liberando..." : "Liberar Money Reset"}
        </Button>
      </form>

      {liberacoes.length > 0 && (
        <div className="flex flex-col divide-y divide-border/60">
          {liberacoes.map((l) => (
            <LinhaDoMoneyReset key={l.id} liberacao={l} />
          ))}
        </div>
      )}
    </Card>
  );
}

function LinhaDoMoneyReset({ liberacao }: { liberacao: Liberacao }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className={`flex items-center gap-3 py-2.5 ${!liberacao.ativo ? "opacity-60" : ""}`}>
      <div className="flex-1 text-sm text-ink">{liberacao.email}</div>
      <span className="text-xs text-ink-faint">{dataFmt.format(liberacao.createdAt)}</span>
      <Badge tone={liberacao.origem === "hubla" ? "accent" : "info"}>{liberacao.origem === "hubla" ? "Hubla" : liberacao.origem === "apple" ? "Apple" : "Manual"}</Badge>
      <Badge tone={liberacao.ativo ? "success" : "neutral"}>{liberacao.ativo ? "Ativo" : "Inativo"}</Badge>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => toggleMoneyResetAction(liberacao.id, !liberacao.ativo))}
        className={`text-xs hover:underline disabled:opacity-40 ${liberacao.ativo ? "text-danger" : "text-success"}`}
      >
        {liberacao.ativo ? "Desligar" : "Ligar"}
      </button>
    </div>
  );
}
