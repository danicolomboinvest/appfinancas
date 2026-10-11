"use client";

import { useSyncExternalStore } from "react";

const CHAVE = "menu-novo-visto";
const TOUR = "welcome-tour-seen";
const EVENTO = "spi:menu-novo";

function ler(): boolean {
  try {
    // Só para quem já usava o app (já viu o tour): quem chega agora aprende pelo tour.
    return window.localStorage.getItem(TOUR) === "1" && window.localStorage.getItem(CHAVE) !== "1";
  } catch {
    return false;
  }
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/**
 * Uma vez por aparelho, para quem já usava o app: "O app mudou de lugar". A barra de baixo
 * saiu; o resto foi para o menu ☰ e a conta para a foto. Nada foi apagado.
 */
export function AvisoMenuNovo() {
  const mostrar = useSyncExternalStore(assinar, ler, () => false);
  if (!mostrar) return null;
  function entendi() {
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      // Sem armazenamento: o aviso volta na próxima abertura, sem quebrar nada.
    }
    window.dispatchEvent(new Event(EVENTO));
  }
  return (
    <div role="dialog" aria-labelledby="aviso-menu-novo" className="fixed left-4 top-[calc(4.25rem+var(--safe-top))] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-3xl bg-surface p-5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35),inset_0_0_0_1px_var(--color-border)] md:hidden">
      <span aria-hidden className="absolute -top-1.5 left-5 size-3 rotate-45 bg-surface" />
      <p id="aviso-menu-novo" className="titulo-tema text-lg font-medium text-ink">O app mudou de lugar</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Metas, Carteira, Decidir e o resto agora ficam aqui no menu. Sua conta e as preferências ficam na sua foto, à direita. Nada foi apagado.
      </p>
      <button type="button" onClick={entendi} className="mt-4 min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas">
        Entendi
      </button>
    </div>
  );
}
