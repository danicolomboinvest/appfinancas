import Link from "next/link";
import { ChevronRight, Sprout } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { conferirMissaoDoDia, lerReset } from "@/lib/repositories/money-reset.repo";
import { TOTAL_DE_DIAS } from "@/lib/money-reset/progresso";

/**
 * Money Reset no Resumo (12/10/2026, versão nova): um cartão pequeno, só para quem comprou (ou é
 * admin), logo abaixo do "Outubro até agora". "Seu Money Reset · Dia X de 21" e "Continuar"; para
 * quem ainda não começou, "Começar". Quem não comprou não vê nada (nada de oferta dentro do app),
 * e ele some quando os 21 dias acabam.
 */
export async function CartaoMoneyReset({ ctx }: { ctx: AuthContext }) {
  if (!(await temMoneyReset(ctx.userId))) return null;
  let reset = await lerReset(ctx);
  if (await conferirMissaoDoDia(ctx, reset)) reset = await lerReset(ctx);
  const { estado } = reset;
  if (estado.fase === "concluido") return null;
  const comecou = estado.fase === "andamento" && estado.atual !== null;
  const href = comecou && estado.disponivel ? `/money-reset/dia/${estado.atual}` : "/money-reset";
  const progresso = Math.round((estado.feitas / TOTAL_DE_DIAS) * 100);
  return (
    <Link href={href} className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3.5" data-cartao-money-reset>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
        <Sprout size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block whitespace-nowrap text-[15px] font-medium text-ink">Seu Money Reset</b>
        <span className="block text-[13px] text-ink-muted">{comecou ? `Dia ${estado.atual} de ${TOTAL_DE_DIAS}` : `${TOTAL_DE_DIAS} dias`}</span>
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
