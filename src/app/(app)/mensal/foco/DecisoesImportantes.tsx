"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Check, Lightbulb } from "lucide-react";

/**
 * "Decisões importantes" (rodada 38 B): o mesmo número do "Pede sua atenção". Tocar abre a lista
 * ali mesmo, e cada item abre a resolução dele. Com zero, vira "Tudo resolvido" e não toca.
 */
export function DecisoesImportantes({ quantas, children }: { quantas: number; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const caixa = "flex min-h-14 w-full items-center gap-3 rounded-full border border-border bg-surface py-2 pl-2 pr-2 text-left";
  if (quantas === 0) {
    return (
      <div className={caixa}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
          <Check size={18} strokeWidth={1.8} />
        </span>
        <span className="text-[15px] text-ink">Tudo resolvido</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={() => setAberta((a) => !a)} aria-expanded={aberta} className={caixa}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <Lightbulb size={18} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] text-ink">Decisões importantes</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-strong">{quantas}</span>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-transform ${aberta ? "rotate-90" : ""}`} aria-hidden>
          <ArrowRight size={18} strokeWidth={1.6} />
        </span>
      </button>
      {aberta && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
