import Link from "next/link";
import { Route } from "lucide-react";

/**
 * Embaixo do cartão da meta (16/10/2026): sem plano, "Como vou juntar?"; com plano, o selo "Com
 * plano" com o resumo, que abre o Combinado. Fica fora do cartão (o cartão inteiro já é um link).
 */
export function BotaoDoPlano({ metaId, plano, money }: { metaId: string; plano: { coisinhas: number; achado: number } | null; money: (v: number) => string }) {
  const href = `/planejamento/metas/${metaId}/plano`;
  if (plano) {
    return (
      <Link href={href} data-com-plano className="mt-2 flex min-h-11 items-center gap-2 rounded-2xl bg-accent-soft px-3.5 py-2 text-[13.5px] font-semibold text-accent-strong">
        <Route size={18} aria-hidden className="shrink-0" />
        <span className="min-w-0">
          Com plano{plano.coisinhas > 0 ? ` · ${plano.coisinhas} ${plano.coisinhas === 1 ? "coisinha" : "coisinhas"}, ${money(plano.achado)} por mês` : ""}
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-accent bg-accent-soft px-4 text-[15px] font-bold text-accent-strong">
      <Route size={18} aria-hidden className="shrink-0" />
      Como vou juntar?
    </Link>
  );
}
