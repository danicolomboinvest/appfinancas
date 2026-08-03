"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { useInstallPlatform, useIsStandalone } from "@/lib/pwa/install";

const DISMISS_KEY = "install-banner-dismissed";
/** O tour de boas-vindas avisa quando termina — o convite só entra DEPOIS, pra não competirem. */
export const TOUR_DONE_EVENT = "spi:welcome-tour-done";
const TOUR_SEEN_KEY = "welcome-tour-seen";

/**
 * Convite discreto pra instalar o app na tela de início. Aparece só no celular, só se ainda
 * não estiver instalado, e some de vez quando a pessoa fecha. Quem fechou (ou quer de novo
 * depois) acha o tutorial pelo menu "Mais".
 */
export function InstallAppBanner({ onOpenTutorial }: { onOpenTutorial: () => void }) {
  const platform = useInstallPlatform();
  const isStandalone = useIsStandalone();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // localStorage só existe no cliente; este efeito lê o estado salvo (fechado antes? tour já
    // visto?), não sincroniza com estado do React.
    function refresh() {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      const tourSeen = window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
      setAllowed(!dismissed && tourSeen);
    }
    refresh();
    window.addEventListener(TOUR_DONE_EVENT, refresh);
    return () => window.removeEventListener(TOUR_DONE_EVENT, refresh);
  }, []);

  const isMobile = platform === "android" || platform === "ios-safari" || platform === "ios-outro";
  if (!allowed || isStandalone || !isMobile) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setAllowed(false);
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <Smartphone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Instale no seu celular</p>
        <p className="text-xs text-ink-faint">Abre em tela cheia, com ícone próprio.</p>
      </div>
      <button
        type="button"
        onClick={onOpenTutorial}
        className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        Ver como
      </button>
      <button
        type="button"
        aria-label="Fechar convite"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
