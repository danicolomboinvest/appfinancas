"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * "Coisinhas normais de app" (Dani, 06/10/2026): ao avançar num passo a passo, a tela volta para
 * o começo do passo novo. Antes ela terminava de preencher lá embaixo, tocava em "Continuar" e
 * continuava lá embaixo, tendo que rolar para cima para achar o começo.
 *
 * Devolve a ref do bloco do passo a passo: quando `passo` muda, a tela sobe até o topo dele
 * (com folga), mas só se o topo tiver ficado para trás; quem já está vendo o começo não é
 * empurrado. Sem a ref, sobe até o topo da página. Quando o passo a passo mora numa folha
 * (o "Editar plano" do Orçamento abre numa), quem rola é a folha, não a página: sobe a folha.
 */
export function useVoltarAoTopo<E extends HTMLElement = HTMLDivElement>(passo: unknown) {
  const ref = useRef<E>(null);
  const anterior = useRef(passo);
  useEffect(() => {
    // Comparar com o anterior (e não "pular a primeira vez") deixa o efeito duplo do modo
    // de desenvolvimento sem rolar nada na montagem.
    if (Object.is(anterior.current, passo)) return;
    anterior.current = passo;
    const el = ref.current;
    const caixa = el ? caixaQueRola(el) : null;
    if (el && caixa) {
      const topo = el.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop - 12;
      if (caixa.scrollTop > topo) caixa.scrollTo({ top: Math.max(0, topo), behavior: "instant" });
      return;
    }
    const topo = el ? el.getBoundingClientRect().top + window.scrollY - 16 : 0;
    if (window.scrollY > topo) window.scrollTo({ top: Math.max(0, topo), behavior: "instant" });
  }, [passo]);
  return ref;
}

/** O ancestral que rola por conta própria (o corpo de uma folha), ou null quando quem rola é a página. */
function caixaQueRola(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * Ao trocar de tela (aba de baixo, abas do mês, qualquer link), a nova começa do topo. O Next
 * mantém a rolagem quando o começo da página nova ainda aparece, e a Dani caía no meio da tela.
 * O voltar do navegador fica de fora: ali o certo é voltar para onde ela estava.
 */
export function useTopoAoTrocarDeTela() {
  const pathname = usePathname();
  const anterior = useRef(pathname);
  const voltando = useRef(false);
  useEffect(() => {
    const aoVoltar = () => {
      voltando.current = true;
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);
  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;
    if (voltando.current) {
      voltando.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
}
