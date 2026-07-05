"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./toast-context";

/** Dispara um toast de sucesso quando `isPending` volta a `false` sem erro (após um "Salvar"). */
export function useSuccessToast(isPending: boolean, error: string | undefined, message = "Salvo com sucesso.") {
  const { showToast } = useToast();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      showToast(message);
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve reagir à transição de isPending/error
  }, [isPending, error]);
}
