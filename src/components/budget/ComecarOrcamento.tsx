"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { PLANO_SALVO } from "./EditarPlano";

/**
 * Orçamento sem plano (protótipo aprovado, `#orc-vazio`): uma foto, "O SPI monta o seu orçamento",
 * "Com base nos seus gastos" e "Montar para mim", que abre o montador numa folha. Ao salvar a
 * folha fecha e a página volta com o "Seu plano".
 */
export function ComecarOrcamento({ titulo, sub, botao, tituloDaFolha, children }: { titulo: string; sub: string; botao: string; tituloDaFolha: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const fechar = () => setAberto(false);
    window.addEventListener(PLANO_SALVO, fechar);
    return () => window.removeEventListener(PLANO_SALVO, fechar);
  }, []);
  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-premium-sm" data-orcamento-vazio>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/fotos/natureza.jpg" alt="" className="h-40 w-full object-cover object-[center_30%]" />
      <div className="flex flex-col items-center gap-1 px-5 pb-5 pt-4 text-center">
        <h2 className="text-[22px] font-semibold leading-tight text-ink">{titulo}</h2>
        <p className="text-[15px] text-ink-muted">{sub}</p>
        <button
          type="button"
          data-guia="orc-editar"
          onClick={() => setAberto(true)}
          className="mt-3 flex min-h-[54px] w-full items-center justify-center rounded-full [background:var(--botao-fundo,var(--color-ink))] px-5 text-[17px] font-semibold [color:var(--botao-tinta,var(--color-canvas))]"
        >
          {botao}
        </button>
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={tituloDaFolha}>
        {children}
      </Modal>
    </section>
  );
}
