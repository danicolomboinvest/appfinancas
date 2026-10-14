"use client";

import { useEffect } from "react";

/**
 * Sem pinça no iPhone (13/10/2026). A Dani: "dava para mover muito a tela, como se desse para dar
 * zoom in, zoom out, sem parecer tanto um aplicativo".
 *
 * O Safari do iPhone ignora o user-scalable=no do viewport (desde o iOS 10, por acessibilidade) e
 * deixa dar pinça mesmo assim. Os eventos gesture* são só do WebKit e só da pinça/rotação com dois
 * dedos: cancelar eles não mexe em rolar, arrastar carrossel, tocar em campo ou arrastar gráfico,
 * que são de um dedo. O duplo toque já não dá zoom pelo touch-action do globals.css.
 */
export function SemPinca() {
  useEffect(() => {
    const parar = (e: Event) => e.preventDefault();
    const opcoes: AddEventListenerOptions = { passive: false };
    for (const tipo of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(tipo, parar, opcoes);
    return () => {
      for (const tipo of ["gesturestart", "gesturechange", "gestureend"]) document.removeEventListener(tipo, parar, opcoes);
    };
  }, []);
  return null;
}
