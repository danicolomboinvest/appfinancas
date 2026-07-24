"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { GoalForm } from "./GoalForm";

/** Botão "Editar" que abre o mesmo form de criação, num modal, já preenchido com os dados
 * atuais da meta — sem isso, a única forma de corrigir algo era apagar e recriar do zero. */
export function EditGoalButton({
  goalId,
  defaults,
}: {
  goalId: string;
  defaults: { name: string; icon: GoalIcon; targetAmount: number; currentAmount: number; targetDate: string; annualRate: number };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink"
      >
        <Pencil size={13} strokeWidth={1.75} />
        Editar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar meta">
        <GoalForm goalId={goalId} defaults={defaults} submitLabel="Salvar alterações" onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
