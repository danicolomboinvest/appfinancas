"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronRight, X } from "lucide-react";
import { dismissMonthlyRecapAction } from "@/app/(app)/resumo-mensal/actions";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/** Convite pro Resumo Mensal no topo do Fluxo, leva pra experiência imersiva de stories.
 * Só aparece na janela de fim/início de mês (decidido no server, ver getRecapEligibility) e
 * some assim que a pessoa fecha — não fica de banner permanente o mês inteiro.
 *
 * Uma linha simples (07/10/2026): saiu o ícone de faísca (virou o símbolo de "feito por IA"), o
 * degradê dourado e a frase de baixo; fica o título na voz do tema e a seta. */
export function MonthlyRecapCard({ monthKey }: { monthKey: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  // O convite fala na voz do tema: é o primeiro "oi" do resumo, e cada tema convida do seu jeito.
  const { voz } = useProfileTheme();
  if (dismissed) return null;

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5 transition-colors hover:bg-surface-hover">
      <Link href="/resumo-mensal" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 active:scale-[0.99]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <CalendarCheck size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{voz.titulos.impResumoPronto}</span>
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
