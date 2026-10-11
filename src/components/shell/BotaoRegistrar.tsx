"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * O + (Registrar) da versão nova: só na Visão geral, no canto de baixo, e some enquanto a
 * pessoa rola para baixo (volta quando ela sobe ou para no topo), para não cobrir o número que
 * ela está lendo. No computador o Registrar mora na barra lateral.
 */
export function BotaoRegistrar({ onClick }: { onClick: () => void }) {
  const { voz } = useProfileTheme();
  const [escondido, setEscondido] = useState(false);
  const ultimo = useRef(0);

  useEffect(() => {
    ultimo.current = window.scrollY;
    function aoRolar() {
      const y = window.scrollY;
      const delta = y - ultimo.current;
      if (Math.abs(delta) < 6) return;
      setEscondido(delta > 0 && y > 80);
      ultimo.current = y;
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={voz.titulos.registrar}
      data-tour="registrar"
      className={`fixed bottom-[calc(1.5rem+var(--safe-bottom))] right-5 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent botao-flutuante shadow-[0_2px_6px_rgba(0,0,0,0.08),0_14px_28px_-10px_color-mix(in_srgb,var(--color-accent)_60%,transparent)] transition-[transform,opacity] duration-300 active:scale-95 md:hidden ${
        escondido ? "pointer-events-none translate-y-6 opacity-0" : "opacity-100"
      }`}
    >
      <Plus size={26} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
