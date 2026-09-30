"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
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
  const { voz } = useProfileTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 44px de toque, igual ao "Remover" do outro lado (DeleteButton).
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Pencil size={15} strokeWidth={1.75} aria-hidden />
        {voz.titulos.formEditar}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={voz.titulos.formMetaEditar}>
        <GoalForm goalId={goalId} defaults={defaults} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
