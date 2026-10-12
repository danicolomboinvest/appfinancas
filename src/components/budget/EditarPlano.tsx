"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, Pencil } from "lucide-react";
import { ResumoDoPlano, type ItemDoResumo } from "./ResumoDoPlano";
import type { AjusteComRotulo } from "./SugestoesDoPadrao";
import { Modal } from "@/components/ui/Modal";

/**
 * "Editar plano" abre o assistente numa janela por cima (01/10/2026). Antes ele abria no meio da
 * página, com um vão branco antes do "Passo 3 de 3", e empurrava todo o resto para baixo.
 */
/** O assistente avisa por este evento quando o plano foi salvo: a janela fecha sozinha. */
export const PLANO_SALVO = "spi:plano-salvo";

export function EditarPlano({
  rotulo,
  titulo,
  largo = false,
  resumo,
  children,
}: {
  rotulo: string;
  titulo: string;
  largo?: boolean;
  /** Versão nova: abre primeiro no "Seu plano" (resumo); o montador fica no "Ajustar". */
  resumo?: { itens: ItemDoResumo[]; ajustes: AjusteComRotulo[]; mes: string };
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [ajustando, setAjustando] = useState(false);
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
        onClick={() => {
          setAjustando(false);
          setAberto(true);
        }}
        data-guia="orc-editar"
        className={
          largo
            ? "flex min-h-12 w-full items-center justify-center rounded-full border border-border-strong bg-surface px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-hover"
            : "inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover"
        }
      >
        {!largo && <Pencil size={15} aria-hidden />} {rotulo}
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={resumo && !ajustando ? "Seu plano" : titulo}>
        {resumo && !ajustando ? (
          <ResumoDoPlano itens={resumo.itens} ajustes={resumo.ajustes} mes={resumo.mes} onAjustar={() => setAjustando(true)} />
        ) : (
          <>
            {resumo && (
              <button type="button" onClick={() => setAjustando(false)} className="-mt-2 mb-2 flex min-h-11 items-center gap-1 text-sm text-ink-muted">
                <ChevronLeft size={16} aria-hidden /> Voltar
              </button>
            )}
            {children}
          </>
        )}
      </Modal>
    </>
  );
}
