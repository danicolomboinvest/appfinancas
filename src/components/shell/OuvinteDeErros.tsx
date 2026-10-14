"use client";

import { useEffect } from "react";
import { registrarErroNoCliente } from "@/lib/erros/erro-do-cliente";
import { arquivoDoAppNaoCarregou } from "@/lib/erros/versao-nova";

/**
 * Todo erro que escapa no aparelho (uma exceção solta, uma promessa recusada sem tratamento) vai
 * para o AppError (12/10/2026). Sem isso, o que quebrava no iPhone de uma cliente não deixava rastro.
 * Até 10 por página, para um erro em laço não virar enxurrada.
 *
 * Versão nova (13/10/2026): o registrar já reconhece o erro de app atualizado com a tela aberta e
 * recarrega. Aqui entra também o arquivo do app (_next/static) que não carregou: se ele voltou
 * 404, a versão mudou e o app recarrega.
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
    // Falha ao carregar <script>/<link> não sobe como ErrorEvent: só aparece na captura.
    const aoFalharArquivo = (e: Event) => {
      const alvo = e.target;
      if (alvo instanceof HTMLScriptElement && alvo.src) arquivoDoAppNaoCarregou(alvo.src);
      else if (alvo instanceof HTMLLinkElement && alvo.href) arquivoDoAppNaoCarregou(alvo.href);
    };
    window.addEventListener("error", aoErro);
    window.addEventListener("error", aoFalharArquivo, true);
    window.addEventListener("unhandledrejection", aoRecusar);
    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("error", aoFalharArquivo, true);
      window.removeEventListener("unhandledrejection", aoRecusar);
    };
  }, []);
  return null;
}
