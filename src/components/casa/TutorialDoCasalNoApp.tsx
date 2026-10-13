"use client";

import { useCallback, useEffect, useState } from "react";
import { TutorialDoCasal } from "./TutorialDoCasal";
import { ABRIR_TUTORIAL_CASAL, CHAVE_LOCAL_TUTORIAL_CASAL, abreOTutorialDoCasal } from "@/lib/casa/tutorial";
import { CHAVE_LOCAL_NOVIDADES, abreAsNovidades, type EstadoDasNovidades } from "@/lib/novidades/passos";
import { TOUR_DONE_EVENT } from "@/components/shell/InstallAppBanner";
import { marcarTutorialDoCasalVistoAction } from "@/app/(app)/configuracoes/casa/actions";
import { trackEvent } from "@/lib/usage/track-event";
import type { CasaNaTela } from "@/lib/casa/regras";

function lerLocal(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

/** Abre o "Como funciona o casal" de qualquer lugar (Configurações › Casa, Como funciona). */
export function abrirTutorialDoCasal() {
  window.dispatchEvent(new Event(ABRIR_TUTORIAL_CASAL));
}

/**
 * O tutorial do casal dentro do app (montado no AppShell, só numa casa simples):
 * - abre sozinho uma vez, para a titular quando a casa liga e para o par quando entra. Se o
 *   "Tivemos uma mudança" ainda vai aparecer, espera ele terminar;
 * - abre de novo pelo evento ABRIR_TUTORIAL_CASAL (Configurações › Casa e o Como funciona).
 *
 * A marca de visto é da conta (no perfil Casal da titular) e também do aparelho, para não abrir
 * de novo enquanto o servidor grava.
 */
export function TutorialDoCasalNoApp({ casa, visto, novidades }: { casa: CasaNaTela; visto: boolean; novidades: EstadoDasNovidades }) {
  const [aberto, setAberto] = useState(false);
  const chaveLocal = `${CHAVE_LOCAL_TUTORIAL_CASAL}:${casa.eu.nome}:${casa.outro.nome}`;

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(ABRIR_TUTORIAL_CASAL, abrir);
    return () => window.removeEventListener(ABRIR_TUTORIAL_CASAL, abrir);
  }, []);

  useEffect(() => {
    if (!abreOTutorialDoCasal({ naCasa: true, vistoNaConta: visto, vistoNesteAparelho: lerLocal(chaveLocal) })) return;
    // O "Tivemos uma mudança" vem primeiro: os dois não se cobrem.
    if (novidades !== "novo" && abreAsNovidades(novidades, false, lerLocal(CHAVE_LOCAL_NOVIDADES))) {
      const depois = () => window.setTimeout(() => setAberto(true), 500);
      window.addEventListener(TOUR_DONE_EVENT, depois, { once: true });
      return () => window.removeEventListener(TOUR_DONE_EVENT, depois);
    }
    const id = window.setTimeout(() => setAberto(true), 700);
    return () => window.clearTimeout(id);
  }, [visto, novidades, chaveLocal]);

  const fechar = useCallback(
    (como: "terminou" | "pulou") => {
      setAberto(false);
      try {
        window.localStorage.setItem(chaveLocal, "1");
      } catch {
        // Sem armazenamento: a marca da conta segura.
      }
      trackEvent(como === "pulou" ? "tutorial_casal_pulou" : "tutorial_casal_terminou", "/tutorial-casal");
      void marcarTutorialDoCasalVistoAction().catch(() => undefined);
    },
    [chaveLocal],
  );

  return <TutorialDoCasal aberto={aberto} eu={casa.eu} outro={casa.outro} fim="pronto" aoFechar={fechar} />;
}
