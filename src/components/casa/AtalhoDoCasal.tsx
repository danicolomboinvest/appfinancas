"use client";

import { ChevronRight } from "lucide-react";
import { DuasBolinhas } from "@/components/casa/Pessoas";
import { abrirTutorialDoCasal } from "@/components/casa/TutorialDoCasalNoApp";
import type { CasaNaTela } from "@/lib/casa/regras";

/** "Como funciona o casal": a linha que reabre o tutorial (folha do Como funciona e /guia). */
export function AtalhoDoCasal({ casa, antes }: { casa: CasaNaTela; antes?: () => void }) {
  return (
    <button
      type="button"
      data-atalho-tutorial-casal
      onClick={() => {
        antes?.();
        abrirTutorialDoCasal();
      }}
      className="flex min-h-16 w-full items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3 text-left hover:bg-surface-hover"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <DuasBolinhas casa={casa} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium text-ink">Como funciona o casal</span>
        <span className="block text-[13.5px] text-ink-muted">Seis passos, menos de um minuto</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
    </button>
  );
}
