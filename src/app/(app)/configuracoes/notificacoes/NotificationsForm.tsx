"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { updateNotificationsAction, type NotificationsState } from "./actions";

const initialState: NotificationsState = {};

export function NotificationsForm({
  defaults,
}: {
  defaults: { notifyBudgetAlerts: boolean; notifyLateGoals: boolean; notifyMonthlyRecap: boolean };
}) {
  const [state, formAction, isPending] = useActionState(updateNotificationsAction, initialState);
  useSuccessToast(isPending, state.error);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-4 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {/* Único item da lista que sai da tela e vai pro e-mail da pessoa — por isso vem
          primeiro e diz explicitamente a frequência. */}
      <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium text-ink">Resumo do mês por e-mail</p>
          <p className="text-xs text-ink-muted">
            Uma vez por mês, no começo do mês: quanto entrou, quanto saiu e o que mudou.
          </p>
        </div>
        <input
          type="checkbox"
          name="notifyMonthlyRecap"
          defaultChecked={defaults.notifyMonthlyRecap}
          className="h-4 w-4 accent-accent"
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium text-ink">Alertas de orçamento estourado</p>
          <p className="text-xs text-ink-muted">Mostra insights quando um gasto ultrapassa o planejado por categoria.</p>
        </div>
        <input
          type="checkbox"
          name="notifyBudgetAlerts"
          defaultChecked={defaults.notifyBudgetAlerts}
          className="h-4 w-4 accent-accent"
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium text-ink">Metas atrasadas</p>
          <p className="text-xs text-ink-muted">Mostra insights quando uma meta está atrasada em relação ao prazo.</p>
        </div>
        <input
          type="checkbox"
          name="notifyLateGoals"
          defaultChecked={defaults.notifyLateGoals}
          className="h-4 w-4 accent-accent"
        />
      </label>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
