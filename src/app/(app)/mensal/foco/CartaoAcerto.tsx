import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DuasBolinhas } from "@/components/casa/Pessoas";
import type { CasaNaTela } from "@/lib/casa/regras";
import type { AcertoDaCasa } from "@/lib/repositories/casa.repo";

/**
 * "Acerto do mês" (Casal simples, protótipo aprovado): debaixo de Decisões importantes, no mesmo
 * desenho. As duas bolinhas, o valor do acerto numa pílula e a seta. Tocar abre o acerto.
 */
export function CartaoAcerto({ acerto, casa, money, href }: { acerto: AcertoDaCasa; casa: CasaNaTela; money: (v: number) => string; href: string }) {
  const valor = Math.round(Math.abs(acerto.euMando));
  const pilula = acerto.acertado ? "Acertado" : valor < 1 ? "Quites" : money(valor);
  return (
    <Link
      href={href}
      data-cartao-acerto
      aria-label={`Acerto do mês: ${pilula}`}
      className="flex min-h-14 w-full items-center gap-3 rounded-full border border-border bg-surface py-2 pl-2 pr-2 text-left"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <DuasBolinhas casa={casa} size={22} />
      </span>
      <span className="min-w-0 flex-1 text-[15px] text-ink">Acerto do mês</span>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-soft px-3 py-1 text-sm font-medium tabular-nums text-accent-strong">{pilula}</span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas" aria-hidden>
        <ArrowRight size={18} strokeWidth={1.6} />
      </span>
    </Link>
  );
}
