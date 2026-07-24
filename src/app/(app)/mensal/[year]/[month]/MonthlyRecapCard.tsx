"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { dismissMonthlyRecapAction } from "@/app/(app)/resumo-mensal/actions";

/** Convite pro Resumo Mensal no topo do Fluxo, leva pra experiência imersiva de stories.
 * Só aparece na janela de fim/início de mês (decidido no server, ver getRecapEligibility) e
 * some assim que a pessoa fecha — não fica de banner permanente o mês inteiro. */
export function MonthlyRecapCard({ monthKey }: { monthKey: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  if (dismissed) return null;

  return (
    <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent-soft via-surface to-surface p-4 transition-all hover:border-accent/60">
      <Link href="/resumo-mensal" className="flex min-w-0 flex-1 items-center gap-3 active:scale-[0.99]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-on-accent shadow-premium-sm">
          <Sparkles size={20} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Seu resumo mensal está pronto</span>
          <span className="block text-xs text-ink-muted">Veja o que aconteceu com o seu dinheiro este mês</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
      </Link>
      <button
        type="button"
        aria-label="Fechar, não mostrar de novo este mês"
        disabled={isPending}
        onClick={() => {
          setDismissed(true);
          startTransition(() => {
            dismissMonthlyRecapAction(monthKey).catch(() => {});
          });
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}
