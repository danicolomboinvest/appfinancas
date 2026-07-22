import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

/** Convite pro Resumo Semanal no topo do Fluxo, leva pra experiência imersiva de stories. */
export function WeeklyRecapCard() {
  return (
    <Link
      href="/resumo-semanal"
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent-soft via-surface to-surface p-4 transition-all hover:border-accent/60 active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-on-accent shadow-premium-sm">
        <Sparkles size={20} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Seu resumo semanal está pronto</span>
        <span className="block text-xs text-ink-muted">Veja o que aconteceu com o seu dinheiro esta semana</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
