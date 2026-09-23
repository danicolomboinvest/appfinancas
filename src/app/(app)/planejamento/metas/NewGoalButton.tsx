"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { GoalForm } from "./GoalForm";

/** Botão "+ Nova meta" que abre o form de criação num modal, a lista de metas já cadastradas
 * fica sempre visível na página, sem o form ocupando o topo o tempo todo. */
export function NewGoalButton() {
  const { voz } = useProfileTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={2} />
        {voz.titulos.formMetaNova}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={voz.titulos.formMetaNova}>
        <GoalForm defaults={{}} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
