"use client";

import { useSyncExternalStore } from "react";

const PREFIXO = "spi:dica:";
/** As dicas que já apareceram nesta visita: continuam na tela até recarregar, mesmo indo e voltando. */
const nestaVisita = new Set<string>();

function deveMostrar(chave: string): boolean {
  if (nestaVisita.has(chave)) return true;
  try {
    if (window.localStorage.getItem(PREFIXO + chave) === "1") return false;
    window.localStorage.setItem(PREFIXO + chave, "1");
    nestaVisita.add(chave);
    return true;
  } catch {
    // Sem armazenamento (aba anônima bloqueada): melhor não mostrar do que mostrar sempre.
    return false;
  }
}

const semAssinatura = () => () => {};

/**
 * Uma linha de explicação que aparece só na primeira vez (06/10/2026). A Dani: "às vezes eu acho
 * que você tenta explicar tudo em muito texto". Frase de ajuda fixa vira ruído na segunda visita;
 * aqui ela aparece na primeira e não volta.
 *
 * No servidor e na hidratação não mostra nada; no navegador, mostra se a pessoa nunca viu.
 */
export function DicaDaPrimeiraVez({ chave, children, className = "text-caption text-ink-muted" }: { chave: string; children: React.ReactNode; className?: string }) {
  const mostrar = useSyncExternalStore(semAssinatura, () => deveMostrar(chave), () => false);
  if (!mostrar) return null;
  return <p className={className}>{children}</p>;
}
