import { ArrowRight } from "lucide-react";
import { DuasBolinhas } from "@/components/casa/Pessoas";
import type { CasaNaTela } from "@/lib/casa/regras";

/** A forma do cartão (a pílula com borda), a mesma no Resumo e no tutorial do casal. */
export const FORMA_DO_ACERTO = "flex min-h-14 w-full items-center gap-3 rounded-full border border-border bg-surface py-2 pl-2 pr-2 text-left";

/**
 * O miolo do cartão: as duas bolinhas, "Acerto do mês", o valor e a seta. `compacto` (o tutorial,
 * numa mini-tela de 240 px): sem a seta e com a letra menor, para caber numa linha a 320 px.
 */
export function MioloDoAcerto({ casa, pilula, compacto = false }: { casa: CasaNaTela; pilula: string; compacto?: boolean }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <DuasBolinhas casa={casa} size={19} />
      </span>
      <span className={`min-w-0 flex-1 text-ink ${compacto ? "whitespace-nowrap text-[13.5px]" : "text-[15px]"}`}>Acerto do mês</span>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-soft px-3 py-1 text-sm font-medium tabular-nums text-accent-strong">{pilula}</span>
      {!compacto && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas" aria-hidden>
          <ArrowRight size={18} strokeWidth={1.6} />
        </span>
      )}
    </>
  );
}
