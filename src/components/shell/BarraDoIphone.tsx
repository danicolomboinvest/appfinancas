"use client";

import { useEffect } from "react";

type CapacitorNoApp = { nativePromise?: (plugin: string, metodo: string, opcoes: object) => Promise<unknown> };

/**
 * No app de iPhone a página vai até as bordas (a partir da build 3, out/2026), então o relógio e
 * a bateria ficam por cima do fundo do site. Este componente diz ao iPhone se o fundo está escuro
 * (texto branco) ou claro (texto preto), e repete sempre que o tema muda. Fora do app, não faz
 * nada; no app antigo, o plugin não existe e a chamada só falha em silêncio.
 */
export function BarraDoIphone() {
  useEffect(() => {
    if (!/SPIFinanceApp-iOS/.test(navigator.userAgent)) return;
    let ultima: boolean | null = null;
    const avisar = () => {
      const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g) ?? ["255", "255", "255"]).map(Number);
      const escura = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
      if (escura === ultima) return;
      ultima = escura;
      const cap = (window as unknown as { Capacitor?: CapacitorNoApp }).Capacitor;
      cap?.nativePromise?.("SpiTela", "barra", { escura }).catch(() => {});
    };
    avisar();
    // O tema muda pela classe (dark/light) e pelo estilo do tema do perfil no <html>.
    const olho = new MutationObserver(avisar);
    olho.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    olho.observe(document.head, { childList: true, subtree: true });
    return () => olho.disconnect();
  }, []);
  return null;
}
