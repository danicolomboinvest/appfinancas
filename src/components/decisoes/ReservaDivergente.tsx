import Link from "next/link";
import { Scale } from "lucide-react";
import { usarReservaDaCarteiraAction } from "@/app/(app)/planejamento/reserva-emergencia/actions";

/**
 * A reserva mora em dois lugares: o valor que a pessoa digitou na tela da reserva e os
 * investimentos marcados como "reserva" na Carteira. Quando os dois não batem, o app avisa em
 * vez de mostrar números diferentes em telas diferentes — e oferece o caminho pra alinhar.
 *
 * `onde` diz em qual tela o aviso está (reserva ou Por Objetivo da carteira).
 */
export function ReservaDivergente({
  naTelaDaReserva,
  naCarteira,
  temInvestimentos,
  nomeDaReserva,
  money,
}: {
  naTelaDaReserva: number;
  naCarteira: number;
  /** Tem algum investimento na Carteira? Quem não usa a Carteira não recebe aviso sobre ela. */
  temInvestimentos: boolean;
  nomeDaReserva: string;
  onde: "reserva" | "carteira";
  money: (v: number) => string;
}) {
  if (!temInvestimentos || Math.abs(naTelaDaReserva - naCarteira) < 1) return null;
  // Uma linha só (07/10/2026, "mesma cara, menos texto"): o rótulo curto, o número da carteira e o
  // botão que resolve. Antes era a frase "A tela da reserva diz R$ X, mas nenhum ativo está marcado
  // como reserva de emergência." Fica na tela da reserva e no Por Objetivo, onde se resolve.
  const semNada = naCarteira <= 0;
  // "Não marcada" (a reserva) ou "Não marcado" (o caixa de segurança, na Empresa).
  const marcada = nomeDaReserva.toLowerCase().includes("caixa") ? "Não marcado na Carteira" : "Não marcada na Carteira";
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
        <Scale size={18} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-ink">{semNada ? marcada : "A Carteira diz outro valor"}</span>
        <span className="block text-caption tabular-nums text-ink-muted">
          {semNada ? "Nenhum investimento marcado" : `Na Carteira ${money(naCarteira)}, aqui ${money(naTelaDaReserva)}`}
        </span>
      </span>
      {semNada ? (
        // Nada marcado como reserva: o caminho é marcar o ativo certo na lista da Carteira.
        <Link href="/carteira" className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-strong">
          Marcar
        </Link>
      ) : (
        <form action={usarReservaDaCarteiraAction} className="shrink-0">
          <button type="submit" className="min-h-10 rounded-full bg-pill px-4 text-sm font-semibold text-on-pill">
            Usar
          </button>
        </form>
      )}
    </div>
  );
}
