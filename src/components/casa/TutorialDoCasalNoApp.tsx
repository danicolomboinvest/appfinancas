"use client";

import { useCallback, useEffect, useState } from "react";
import { TutorialDoCasal } from "./TutorialDoCasal";
import { AvisoDaMigracao } from "./AvisoDaMigracao";
import { CHAVE_LOCAL_AVISO_MIGRACAO, oQueAbreSozinho } from "@/lib/casa/aviso-migracao";
import { ABRIR_TUTORIAL_CASAL, CHAVE_LOCAL_TUTORIAL_CASAL, abreOTutorialDoCasal } from "@/lib/casa/tutorial";
import { CHAVE_LOCAL_NOVIDADES, abreAsNovidades, type EstadoDasNovidades } from "@/lib/novidades/passos";
import { TOUR_DONE_EVENT } from "@/components/shell/InstallAppBanner";
import { marcarAvisoDaMigracaoVistoAction, marcarTutorialDoCasalVistoAction } from "@/app/(app)/configuracoes/casa/actions";
import { trackEvent } from "@/lib/usage/track-event";
import type { CasaNaTela } from "@/lib/casa/regras";

function gravarLocal(chave: string) {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    // Sem armazenamento: a marca da conta segura.
  }
}

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
 * - numa casa que veio do Nós dois, antes dele vem uma vez o "O casal ficou mais simples"
 *   (AvisoDaMigracao): "Ver como funciona" abre o tutorial, "Agora não" fecha os dois;
 * - abre de novo pelo evento ABRIR_TUTORIAL_CASAL (Configurações › Casa e o Como funciona).
 *
 * As marcas de visto são da conta (no perfil Casal da titular) e também do aparelho, para não
 * abrir de novo enquanto o servidor grava.
 */
export function TutorialDoCasalNoApp({
  casa,
  visto,
  avisoDaMigracao = false,
  novidades,
}: {
  casa: CasaNaTela;
  visto: boolean;
  /** Casa migrada do Nós dois e o aviso ainda não visto nesta conta. */
  avisoDaMigracao?: boolean;
  novidades: EstadoDasNovidades;
}) {
  const [aberto, setAberto] = useState<"aviso" | "tutorial" | null>(null);
  const chaveLocal = `${CHAVE_LOCAL_TUTORIAL_CASAL}:${casa.eu.nome}:${casa.outro.nome}`;
  const chaveLocalAviso = `${CHAVE_LOCAL_AVISO_MIGRACAO}:${casa.eu.nome}:${casa.outro.nome}`;

  useEffect(() => {
    const abrir = () => setAberto("tutorial");
    window.addEventListener(ABRIR_TUTORIAL_CASAL, abrir);
    return () => window.removeEventListener(ABRIR_TUTORIAL_CASAL, abrir);
  }, []);

  useEffect(() => {
    const primeiro = oQueAbreSozinho({
      naCasa: true,
      migrada: avisoDaMigracao,
      avisoVisto: lerLocal(chaveLocalAviso),
      tutorialVisto: !abreOTutorialDoCasal({ naCasa: true, vistoNaConta: visto, vistoNesteAparelho: lerLocal(chaveLocal) }),
    });
    if (!primeiro) return;
    // O "Tivemos uma mudança" vem primeiro: os dois não se cobrem.
    if (novidades !== "novo" && abreAsNovidades(novidades, false, lerLocal(CHAVE_LOCAL_NOVIDADES))) {
      const depois = () => window.setTimeout(() => setAberto(primeiro), 500);
      window.addEventListener(TOUR_DONE_EVENT, depois, { once: true });
      return () => window.removeEventListener(TOUR_DONE_EVENT, depois);
    }
    const id = window.setTimeout(() => setAberto(primeiro), 700);
    return () => window.clearTimeout(id);
  }, [visto, avisoDaMigracao, novidades, chaveLocal, chaveLocalAviso]);

  const fechar = useCallback(
    (como: "terminou" | "pulou") => {
      setAberto(null);
      gravarLocal(chaveLocal);
      trackEvent(como === "pulou" ? "tutorial_casal_pulou" : "tutorial_casal_terminou", "/tutorial-casal");
      void marcarTutorialDoCasalVistoAction().catch(() => undefined);
    },
    [chaveLocal],
  );

  const fecharAviso = useCallback(
    (como: "ver" | "agora-nao") => {
      gravarLocal(chaveLocalAviso);
      if (como === "agora-nao") gravarLocal(chaveLocal);
      trackEvent(como === "ver" ? "aviso_casa_migrada_ver" : "aviso_casa_migrada_agora_nao", "/aviso-casa-migrada");
      void marcarAvisoDaMigracaoVistoAction(como).catch(() => undefined);
      setAberto(como === "ver" ? "tutorial" : null);
    },
    [chaveLocal, chaveLocalAviso],
  );
  const aoVer = useCallback(() => fecharAviso("ver"), [fecharAviso]);
  const aoAgoraNao = useCallback(() => fecharAviso("agora-nao"), [fecharAviso]);

  return (
    <>
      <AvisoDaMigracao aberto={aberto === "aviso"} casa={casa} aoVer={aoVer} aoAgoraNao={aoAgoraNao} />
      <TutorialDoCasal aberto={aberto === "tutorial"} eu={casa.eu} outro={casa.outro} fim="pronto" aoFechar={fechar} />
    </>
  );
}
