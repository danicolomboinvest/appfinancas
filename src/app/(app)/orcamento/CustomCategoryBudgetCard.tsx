"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { CUSTOM_CATEGORY_ICON_MAP } from "@/lib/categories";
import {
  applyBudgetToWholeYearForCustomCategoryAction,
  deleteCustomCategoryAction,
  type AnnualBudgetState,
} from "./actions";

const initialState: AnnualBudgetState = {};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesmo cartão de planejamento anual que BudgetCategoryCard, só que pra uma categoria criada
 * pelo próprio usuário — por isso também tem um botão de apagar, com confirmação. */
export function CustomCategoryBudgetCard({
  year,
  customCategoryId,
  name,
  icon,
  defaultValue,
}: {
  year: number;
  customCategoryId: string;
  name: string;
  icon: string;
  defaultValue: number;
}) {
  const [state, formAction, isPending] = useActionState(applyBudgetToWholeYearForCustomCategoryAction, initialState);
  useSuccessToast(isPending, state.error, "Planejamento salvo para os 12 meses do ano.");
  const [monthly, setMonthly] = useState(defaultValue);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const Icon = CUSTOM_CATEGORY_ICON_MAP[icon] ?? Tag;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-ink-faint">Categoria personalizada</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
          aria-label={`Apagar categoria ${name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="customCategoryId" value={customCategoryId} />

        {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}

        <CurrencyField
          label="Quanto pretende gastar por mês?"
          name="plannedAmount"
          defaultValue={defaultValue}
          onValueChange={setMonthly}
        />

        <p className="text-xs text-ink-muted">
          = <span className="font-medium text-ink">{formatBRL(monthly * 12)}</span> por ano
        </p>

        <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="w-fit">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Apagar categoria?">
        <p className="text-sm text-ink-muted">
          Tem certeza que quer apagar <span className="font-medium text-ink">{name}</span>? Os lançamentos que já
          usaram essa categoria continuam existindo, só perdem a categorização.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={isDeleting}
            onClick={() => startDelete(async () => { await deleteCustomCategoryAction(customCategoryId); })}
          >
            {isDeleting ? "Apagando..." : "Apagar categoria"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
