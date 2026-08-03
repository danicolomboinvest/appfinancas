"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Rastreio de uso primeiro (nada de script de terceiro): a cada troca de tela dentro do app,
 * manda um evento "pageview" pro /api/track — junto vai se o app está INSTALADO (aberto pela
 * tela de início) ou no navegador, pra medir o efeito do tutorial de instalação.
 *
 * Melhor esforço de verdade: fire-and-forget com keepalive (sobrevive à troca de página),
 * falha é silenciosa, e nada aqui bloqueia a navegação de ninguém.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSentRef.current === pathname) return;
    lastSentRef.current = pathname;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "pageview", path: pathname, standalone }),
      keepalive: true,
    }).catch(() => {
      // Offline ou bloqueado: o evento se perde e está tudo bem.
    });
  }, [pathname]);

  return null;
}
