"use client";

import { useEffect } from "react";
import { registrarErroNoCliente } from "@/lib/erros/erro-do-cliente";

/**
 * Todo erro que escapa no aparelho (uma exceção solta, uma promessa recusada sem tratamento) vai
 * para o AppError (12/10/2026). Sem isso, o que quebrava no iPhone de uma cliente não deixava rastro.
 * Até 10 por página, para um erro em laço não virar enxurrada.
 */
export function OuvinteDeErros() {
  useEffect(() => {
    let enviados = 0;
    const aoErro = (e: ErrorEvent) => {
      if (enviados++ >= 10) return;
      registrarErroNoCliente("janela", e.error ?? e.message);
    };
    const aoRecusar = (e: PromiseRejectionEvent) => {
      if (enviados++ >= 10) return;
      registrarErroNoCliente("promessa", e.reason);
    };
    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRecusar);
    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRecusar);
    };
  }, []);
  return null;
}
