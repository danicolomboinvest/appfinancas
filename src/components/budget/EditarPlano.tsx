"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * "Editar plano" abre o assistente numa janela por cima (01/10/2026). Antes ele abria no meio da
 * página, com um vão branco antes do "Passo 3 de 3", e empurrava todo o resto para baixo.
 */
/** O assistente avisa por este evento quando o plano foi salvo: a janela fecha sozinha. */
export const PLANO_SALVO = "spi:plano-salvo";

export function EditarPlano({ rotulo, titulo, children }: { rotulo: string; titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  // Salvou: fecha a janela (07/10/2026). Antes ela ficava aberta no passo 3 depois do "Salvar", e o
  // único sinal era um aviso pequeno no rodapé; a Dani achava que não tinha salvo. Fechando, ela
  // vê o plano novo na página de trás, já atualizada.
  useEffect(() => {
    const fechar = () => setAberto(false);
    window.addEventListener(PLANO_SALVO, fechar);
    return () => window.removeEventListener(PLANO_SALVO, fechar);
  }, []);
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
