"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * Pergunta antes de fechar a gaveta no meio da revisão da importação.
 *
 * O "Voltar" da gaveta, o X, o toque fora e o Esc fechavam tudo sem perguntar: 20 minutos
 * classificando gastos iam embora num toque sem querer, e ela tinha que subir o arquivo de novo.
 *
 * Funciona sem mexer na gaveta (RegistrarDrawer) nem no Modal, que são de todo o app: escuta o
 * clique e o Esc ANTES deles (fase de captura na janela) e, se o toque é num botão da gaveta que
 * fica FORA da área da importação, segura o clique e pergunta. Confirmado, repete o mesmo clique
 * (ou o mesmo Esc) liberado, e a gaveta fecha do jeito de sempre. Os botões da própria
 * importação, que ficam dentro de `areaRef`, passam direto.
 */
export function ProtegerSaida({
  ativo,
  areaRef,
  textos,
}: {
  /** Só protege quando há trabalho a perder (revisão ou conferência abertas). */
  ativo: boolean;
  /** A área da importação: clique aqui dentro nunca é "sair". */
  areaRef: RefObject<HTMLElement | null>;
  textos: { titulo: string; dica: string; ficar: string; sair: string };
}) {
  const [pendente, setPendente] = useState<null | (() => void)>(null);
  const liberado = useRef(false);
  // Os ouvintes da janela vivem fora do render: leem a pergunta aberta por aqui.
  const pendenteRef = useRef(pendente);
  useEffect(() => {
    pendenteRef.current = pendente;
  }, [pendente]);

  useEffect(() => {
    if (!ativo) return;

    /** A gaveta inteira: o ancestral da área que é filho direto do body (o portal do Modal). */
    const gaveta = (): HTMLElement | null => {
      let el = areaRef.current;
      while (el && el.parentElement && el.parentElement !== document.body) el = el.parentElement;
      return el && el.parentElement === document.body ? el : null;
    };

    function aoClicar(e: MouseEvent) {
      if (liberado.current || pendenteRef.current) return;
      const alvo = e.target instanceof Element ? e.target.closest("button, a") : null;
      const area = areaRef.current;
      const raiz = gaveta();
      if (!(alvo instanceof HTMLElement) || !area || !raiz) return;
      if (area.contains(alvo) || !raiz.contains(alvo)) return;
      e.preventDefault();
      e.stopPropagation();
      setPendente(() => () => {
        liberado.current = true;
        try {
          alvo.click();
        } finally {
          liberado.current = false;
        }
      });
    }

    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape" || liberado.current) return;
      e.preventDefault();
      e.stopPropagation();
      // Com a pergunta aberta, Esc é "não, fico": fecha só a pergunta.
      if (pendenteRef.current) {
        setPendente(null);
        return;
      }
      setPendente(() => () => {
        liberado.current = true;
        try {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        } finally {
          liberado.current = false;
        }
      });
    }

    // Fechar a aba ou recarregar a página no meio: o navegador pergunta com a frase dele.
    function aoSairDaPagina(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("click", aoClicar, true);
    window.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("beforeunload", aoSairDaPagina);
    return () => {
      window.removeEventListener("click", aoClicar, true);
      window.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("beforeunload", aoSairDaPagina);
    };
  }, [ativo, areaRef]);

  if (!pendente || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0" role="alertdialog" aria-modal="true" aria-labelledby="sair-importacao-titulo">
      <div className="fixed inset-0 bg-black/60" aria-hidden />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-premium">
        <p id="sair-importacao-titulo" className="text-base font-semibold text-ink">
          {textos.titulo}
        </p>
        <p className="text-sm text-ink-muted">{textos.dica}</p>
        <Button type="button" className="min-h-11" autoFocus onClick={() => setPendente(null)}>
          {textos.ficar}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            const sair = pendente;
            setPendente(null);
            sair();
          }}
        >
          {textos.sair}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
