"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

/**
 * Tocar no número grande do Resumo abre "O que entrou nos R$ 2.282" (pedido da Dani, 14/10/2026),
 * com a troca "Outubro | Setembro até 14". Os dois lados chegam prontos do servidor.
 */
export function AbrirDetalhe({ children, rotulo, lados }: { children: ReactNode; rotulo: string; lados: { aba: string; titulo: string; conteudo: ReactNode }[] }) {
  const [aberto, setAberto] = useState(false);
  const [lado, setLado] = useState(0);
  const atual = lados[lado] ?? lados[0];
  const abrir = () => {
    setLado(0);
    setAberto(true);
  };
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={rotulo}
        aria-haspopup="dialog"
        onClick={abrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrir();
          }
        }}
        className="cursor-pointer rounded-3xl transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        data-abrir-detalhe
      >
        {children}
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={atual.titulo}>
        <div className="flex flex-col gap-3">
          {lados.length > 1 && (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="tablist">
              {lados.map((l, i) => (
                <button
                  key={l.aba}
                  type="button"
                  role="tab"
                  aria-selected={i === lado}
                  onClick={() => setLado(i)}
                  className="min-h-10 truncate rounded-full px-2 text-[14px] font-medium text-ink-muted aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm"
                >
                  {l.aba}
                </button>
              ))}
            </div>
          )}
          {atual.conteudo}
        </div>
      </Modal>
    </>
  );
}
