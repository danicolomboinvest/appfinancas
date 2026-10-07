"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./toast-context";

/** Avisa que um formulário salvou: a janela que o abriu fecha sozinha (07/10/2026). */
export const FORM_SALVO = "spi:form-salvo";

/** Dispara um toast de sucesso quando `isPending` volta a `false` sem erro (após um "Salvar"). */
export function useSuccessToast(isPending: boolean, error: string | undefined, message = "Salvo com sucesso.") {
  const { showToast } = useToast();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      showToast(message);
      // Quem abriu o formulário numa janela (ver EditarNoCanto) fecha ao ouvir este aviso.
      window.dispatchEvent(new Event(FORM_SALVO));
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve reagir à transição de isPending/error
  }, [isPending, error]);
}
