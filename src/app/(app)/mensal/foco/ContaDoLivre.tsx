"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

/**
 * O número livre do Foco abre a própria conta (07/10/2026, "mesma cara, menos texto"): o cartão
 * inteiro é o botão. Antes havia um "Como cheguei nisso" escrito embaixo do número, em toda visita,
 * para uma conta que quase ninguém abre.
 */
export function ContaDoLivre({ titulo, conta, children }: { titulo: string; conta: ReactNode; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label={titulo} className="block w-full text-left transition-transform active:scale-[0.99]">
        {children}
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={titulo}>
        {conta}
      </Modal>
    </>
  );
}
