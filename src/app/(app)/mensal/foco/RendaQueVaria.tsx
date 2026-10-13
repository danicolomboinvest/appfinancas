"use client";

import { useOptimistic, useTransition } from "react";
import { escolherRendaDaSemanaAction } from "./actions";

/**
 * "Minha renda varia: conto só o que já entrou" (regra A, 13/10/2026). Ligado, a semana cabe no
 * que já entrou no mês, não na renda planejada. Para quem é autônoma ou recebe por comissão.
 */
export function RendaQueVaria({ ligado }: { ligado: boolean }) {
  const [pendente, comecar] = useTransition();
  const [agora, mudar] = useOptimistic(ligado);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={agora}
      disabled={pendente}
      onClick={() =>
        comecar(async () => {
          mudar(!agora);
          await escolherRendaDaSemanaAction(!agora);
        })
      }
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-2.5 text-left shadow-[inset_0_0_0_1px_var(--color-border)]"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">Minha renda varia</span>
        <span className="block text-[12.5px] text-ink-muted">Contar só o que já entrou</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${agora ? "bg-accent-strong" : "bg-border-strong"}`} aria-hidden>
        <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${agora ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
