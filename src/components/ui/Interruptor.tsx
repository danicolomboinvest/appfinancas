"use client";

import type { ReactNode } from "react";

/**
 * Liga e desliga no jeito do iPhone (versão nova): a linha inteira é o toque (44px), o título à
 * esquerda, a chave à direita. `role="switch"` para o leitor de tela.
 */
export function Interruptor({ ligado, aoMudar, titulo, sub, icone, desabilitado = false }: { ligado: boolean; aoMudar: (v: boolean) => void; titulo: string; sub?: string; icone?: ReactNode; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60"
    >
      {icone && <span className="shrink-0 text-ink-muted">{icone}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{titulo}</span>
        {sub && <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{sub}</span>}
      </span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? "bg-accent" : "bg-[color-mix(in_srgb,var(--color-ink)_16%,transparent)]"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Opções lado a lado numa pílula (Não repete · A cada… · Meses que escolho). */
export function Segmentado<T extends string>({ opcoes, valor, aoEscolher, rotulo }: { opcoes: readonly { valor: T; rotulo: string }[]; valor: T; aoEscolher: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex w-full rounded-full bg-surface-2 p-1">
      {opcoes.map((o) => {
        const on = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => aoEscolher(o.valor)}
            className={`min-h-10 min-w-0 flex-1 rounded-full px-1.5 text-[13px] leading-tight transition-colors ${on ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
