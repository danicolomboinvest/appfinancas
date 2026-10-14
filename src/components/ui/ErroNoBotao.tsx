"use client";

import { useCallback, useState } from "react";
import { vibrar } from "@/lib/celebrar";

/**
 * Erro no lugar (14/10/2026): quando um botão falha, o erro fica escrito embaixo dele e o botão
 * vira "Tentar de novo", até a próxima tentativa. Antes ia para o rodapé e sumia em 6 s, longe
 * do botão que falhou.
 *
 *   const salvar = useErroNoBotao();
 *   ...onClick={() => { salvar.limpar(); fazer().then((r) => !r.ok && salvar.falhou("Não salvou")) }}
 *   <button className={salvar.classe}>{salvar.erro ? TENTAR_DE_NOVO : "Salvar"}</button>
 *   <ErroNoBotao erro={salvar.erro} />
 */

export const TENTAR_DE_NOVO = "Tentar de novo";

export function useErroNoBotao() {
  const [erro, setErro] = useState<string | null>(null);
  const falhou = useCallback((mensagem: string) => {
    vibrar("erro");
    setErro(mensagem);
  }, []);
  const limpar = useCallback(() => setErro(null), []);
  // Treme o botão uma vez a cada falha: limpar() na nova tentativa tira a classe, e a próxima
  // falha põe de volta (sem movimento para quem pede menos movimento).
  return { erro, falhou, limpar, classe: erro ? "erro-treme" : "" };
}

/** A mensagem curta embaixo do botão que falhou. Some quando a pessoa tenta de novo. */
const LADO = { centro: "text-center", esquerda: "text-left", direita: "text-right" } as const;

export function ErroNoBotao({ erro, lado = "centro", className = "" }: { erro: string | null | undefined; lado?: keyof typeof LADO; className?: string }) {
  return (
    <p aria-live="polite" className={`text-label font-semibold text-danger ${LADO[lado]} ${erro ? "mt-1.5" : "sr-only"} ${className}`}>
      {erro ?? ""}
    </p>
  );
}
