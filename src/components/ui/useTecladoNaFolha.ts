"use client";

import { useEffect, useState, type RefObject } from "react";
import { abreTeclado, alturaDoTeclado } from "@/lib/ui/teclado";

/**
 * Folha (bottom sheet) que não fica atrás do teclado do iPhone. Devolve a altura do teclado para
 * entrar no padding de baixo da folha, e a altura visível para limitar a folha a ela. Ao focar
 * um campo dentro da folha, rola até ele ficar no meio do que sobra da tela.
 */
export function useTecladoNaFolha(painel: RefObject<HTMLElement | null>, ligado: boolean): { teclado: number; alturaVisivel: number | null } {
  const [medida, setMedida] = useState<{ teclado: number; alturaVisivel: number | null }>({ teclado: 0, alturaVisivel: null });

  useEffect(() => {
    if (!ligado || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const teclado = alturaDoTeclado({ alturaDaJanela: window.innerHeight, alturaVisivel: vv.height, topoVisivel: vv.offsetTop });
      setMedida({ teclado, alturaVisivel: teclado > 0 ? Math.round(vv.height) : null });
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [ligado]);

  useEffect(() => {
    const el = painel.current;
    if (!ligado || !el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const noFoco = (e: FocusEvent) => {
      const alvo = e.target as Element | null;
      if (!abreTeclado(alvo)) return;
      // O teclado leva uns 250 ms para subir: rola depois, quando a janela visível já encolheu.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (alvo as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    el.addEventListener("focusin", noFoco);
    return () => {
      el.removeEventListener("focusin", noFoco);
      if (timer) clearTimeout(timer);
    };
  }, [painel, ligado]);

  return medida;
}
