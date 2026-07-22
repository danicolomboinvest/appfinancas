"use client";

import { useState, useTransition } from "react";
import { Trash2, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CUSTOM_CATEGORY_ICON_MAP, colorForCategorySlice } from "@/lib/categories";
import { deleteCustomCategoryAction } from "./actions";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesmo cartão de planejamento anual que BudgetCategoryCard (sem form/submit próprio, ver
 * OrcamentoForm.tsx), só que pra uma categoria criada pelo usuário, por isso também tem um
 * botão de apagar, com confirmação, que continua sendo uma ação imediata e separada. */
export function CustomCategoryBudgetCard({
  customCategoryId,
  name,
  icon,
  defaultValue,
}: {
  customCategoryId: string;
  name: string;
  icon: string;
  defaultValue: number;
}) {
  const [monthly, setMonthly] = useState(defaultValue);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const Icon = CUSTOM_CATEGORY_ICON_MAP[icon] ?? Tag;
  const color = colorForCategorySlice({ kind: "custom", value: customCategoryId });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <CategoryIcon icon={Icon} color={color} />
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

      <input type="hidden" name="customCategoryId" value={customCategoryId} />

      <CurrencyField
        label="Quanto pretende gastar por mês?"
        name={`plannedAmount_custom_${customCategoryId}`}
        defaultValue={defaultValue}
        onValueChange={setMonthly}
      />

      <p className="text-xs text-ink-muted">
        = <span className="font-medium text-ink">{formatBRL(monthly * 12)}</span> por ano
      </p>

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
