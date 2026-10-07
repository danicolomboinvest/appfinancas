"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FORM_SALVO } from "@/components/ui/useSuccessToast";

/**
 * O lápis no canto do cartão do número (07/10/2026). Substitui o link dourado "Editar meus dados ▾"
 * que abria o formulário no meio da página: a Dani achou que tinha cara de IA. O formulário abre
 * numa janela e ela fecha sozinha quando salva.
 */
/** `titulo` é o nome da janela (o da tela, ex.: "Aposentadoria"); o botão se chama "Editar". */
export function EditarNoCanto({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const fechar = () => setAberto(false);
    window.addEventListener(FORM_SALVO, fechar);
    return () => window.removeEventListener(FORM_SALVO, fechar);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Editar"
        className="heroi-veu flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80"
      >
        <Pencil size={16} aria-hidden />
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={titulo}>
        {children}
      </Modal>
    </>
  );
}
