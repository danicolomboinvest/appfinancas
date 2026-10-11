"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Nativo = { nativePromise?: (plugin: string, metodo: string, opcoes?: object) => Promise<Record<string, unknown>> };

/** Telas de quem ainda não entrou (ou acabou de sair). Igual às PUBLIC_PATHS do proxy. */
const DE_FORA = ["/login", "/register", "/esqueci-senha", "/redefinir-senha", "/confirmar-email"];

/**
 * A ponte do widget do iPhone (11/10/2026). Dentro do app, com ela logada, garante que a extensão
 * do widget tenha a chave dela (POST /api/widget/token, guardada pelo plugin nativo SpiWidget no
 * App Group) e pede para o widget se redesenhar a cada tela, para o número e o tema da tela
 * inicial acompanharem o app. Saiu da conta (caiu no /login): o app apaga e revoga a chave.
 *
 * Fora do app, ou no app antigo sem o plugin, não faz nada.
 */
export function PonteDoWidget() {
  const caminho = usePathname();

  useEffect(() => {
    if (!/SPIFinanceApp-iOS/.test(navigator.userAgent)) return;
    const cap = (window as unknown as { Capacitor?: Nativo }).Capacitor;
    if (!cap?.nativePromise) return;
    const chamar = (metodo: string, opcoes?: object) => cap.nativePromise!("SpiWidget", metodo, opcoes);

    if (DE_FORA.some((p) => caminho.startsWith(p))) {
      chamar("sair").catch(() => {});
      return;
    }
    if (caminho === "/" || caminho.startsWith("/comecar")) return;

    let cancelado = false;
    (async () => {
      const estado = await chamar("estado");
      if (cancelado) return;
      if (estado.temChave !== true && typeof estado.aparelho === "string") {
        const r = await fetch("/api/widget/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aparelho: estado.aparelho }) });
        if (!r.ok || cancelado) return;
        const { chave } = (await r.json()) as { chave?: string };
        if (chave) await chamar("salvar", { chave, base: window.location.origin });
      } else {
        await chamar("atualizar");
      }
    })().catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [caminho]);

  return null;
}
