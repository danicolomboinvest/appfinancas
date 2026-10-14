"use client";

import { useSyncExternalStore } from "react";

/**
 * Os selinhos do item (14/10/2026, "B como regra"): a confirmação que fica no próprio item, no
 * lugar do aviso solto. "Foi pontual" na folha "O que fazer?" marca a categoria com "pontual";
 * a linha da categoria, em outra parte da tela, lê daqui e mostra o selinho.
 *
 * Guarda só nesta visita (sessionStorage), por chave (ex.: "cat-SAUDE"). O dado de verdade
 * continua no servidor; isto é a resposta imediata na tela.
 */

const CHAVE = "spi:selos";
type Selos = Record<string, string>;

let selos: Selos = ler();
const ouvintes = new Set<() => void>();

function ler(): Selos {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CHAVE) ?? "{}") as Selos;
  } catch {
    return {};
  }
}

export function marcarSelo(chave: string, texto: string | null) {
  const novo = { ...selos };
  if (texto) novo[chave] = texto;
  else delete novo[chave];
  selos = novo;
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(selos));
  } catch {}
  ouvintes.forEach((o) => o());
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

const VAZIO: Selos = {};

/** Todos os selinhos marcados nesta visita. */
export function useSelos(): Selos {
  return useSyncExternalStore(assinar, () => selos, () => VAZIO);
}

/** A chave do selinho de uma categoria num mês ("outubro"): a mesma na folha e na lista. */
export function seloDaCategoria(categoria: string, mes: string | undefined) {
  return `cat-${categoria}@${mes ?? ""}`;
}

/** O mês de hoje como o Orçamento escreve ("outubro"), para o teto e o "pontual" do mês. */
export function mesDeHoje() {
  return new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
}
