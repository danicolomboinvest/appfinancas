"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * "Editar plano" abre o assistente numa janela por cima (01/10/2026). Antes ele abria no meio da
 * página, com um vão branco antes do "Passo 3 de 3", e empurrava todo o resto para baixo.
 */
export function EditarPlano({ rotulo, titulo, children }: { rotulo: string; titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-guia="orc-editar"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover"
      >
        <Pencil size={15} aria-hidden /> {rotulo}
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={titulo}>
        {children}
      </Modal>
    </>
  );
}
