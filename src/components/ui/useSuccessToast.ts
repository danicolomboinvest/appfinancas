"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./toast-context";

/** Avisa que um formulário salvou: a janela que o abriu fecha sozinha (07/10/2026). */
export const FORM_SALVO = "spi:form-salvo";

/**
 * Reage ao fim de um "Salvar" (`isPending` volta a `false` sem erro): avisa a janela que abriu o
 * formulário (ela fecha) e chama `aoSalvar`, se houver.
 *
 * Desde 14/10/2026 não há mais texto padrão ("Salvo com sucesso." saiu): a folha fecha e o item
 * aparece, e isso já é a confirmação. `message` só para o caso raro em que o resultado sai da
 * tela; aí vira a pílula curta.
 */
export function useSuccessToast(isPending: boolean, error: string | undefined, message?: string, aoSalvar?: () => void) {
  const { showToast } = useToast();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      if (message) showToast(message);
      aoSalvar?.();
      // Quem abriu o formulário numa janela (ver EditarNoCanto) fecha ao ouvir este aviso.
      window.dispatchEvent(new Event(FORM_SALVO));
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve reagir à transição de isPending/error
  }, [isPending, error]);
}
