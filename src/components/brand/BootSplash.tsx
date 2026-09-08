"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

/** Tempo mínimo visível: sem isso, numa conexão rápida o splash pisca por 1 frame e some —
 * parece bug, não intenção. Com um mínimo, o boot sempre tem aquele instante de "abrindo o
 * app" antes de sumir, igual app nativo. */
const MIN_VISIBLE_MS = 400;

/**
 * Cobre o vão "tela em branco" entre abrir o app instalado (PWA) e o conteúdo de verdade
 * aparecer — já nasce no HTML (sem depender de JS pra SER MOSTRADO, só pra sumir depois),
 * então cobre inclusive a demora de rede antes do bundle carregar. Some sozinho assim que o
 * React hidrata + o tempo mínimo passa, nunca precisa ser chamado de fora.
 */
export function BootSplash() {
  const [hiding, setHiding] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHiding(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <div
      aria-hidden="true"
      onTransitionEnd={() => hiding && setHidden(true)}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-canvas transition-opacity duration-300 ease-out ${
        hiding ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute h-20 w-20 animate-spin rounded-full border-2 border-accent-soft border-t-accent" />
        <BrandMark size={56} />
      </div>
    </div>
  );
}
