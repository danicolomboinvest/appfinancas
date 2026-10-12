import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { lerResetConferido } from "@/lib/repositories/money-reset.repo";
import { TOTAL_DE_MARCOS } from "@/lib/money-reset/progresso";
import { marco } from "@/lib/money-reset/missoes";
import { IconeDoMarco } from "@/components/money-reset/IconeDoMarco";

/**
 * Money Reset no Resumo (versão A+B, 12/10/2026): um cartão pequeno, só para quem comprou (ou é
 * admin), logo abaixo do "Outubro até agora". "Missão X de 21" com o desenho da missão e
 * "Continuar"; quem ainda não começou vê "Começar". Leva direto à missão de agora (ela abre sem
 * esperar o dia virar). Quem não comprou não vê nada, e ele some quando o mapa termina.
 */
export async function CartaoMoneyReset({ ctx }: { ctx: AuthContext }) {
  if (!(await temMoneyReset(ctx.userId))) return null;
  const { estado } = await lerResetConferido(ctx);
  if (estado.fase === "concluido" || estado.atual === null) return null;
  const atual = marco(estado.atual)!;
  const comecou = estado.feitos > 0;
  const progresso = Math.round((estado.feitos / TOTAL_DE_MARCOS) * 100);
  return (
    <Link href={comecou ? `/money-reset/dia/${atual.n}` : "/money-reset"} className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3.5" data-cartao-money-reset>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
        <IconeDoMarco icone={atual.icone} size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block whitespace-nowrap text-[15px] font-medium text-ink">Seu Money Reset</b>
        <span className="block text-[13px] text-ink-muted">{`Missão ${atual.n} de ${TOTAL_DE_MARCOS}`}</span>
        {comecou && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${progresso}%` }} />
          </span>
        )}
      </span>
      <span className="inline-flex min-h-10 shrink-0 items-center gap-0.5 rounded-full bg-surface-2 px-3 text-sm font-medium text-ink">
        {comecou ? "Continuar" : "Começar"}
        <ChevronRight size={15} aria-hidden />
      </span>
    </Link>
  );
}
