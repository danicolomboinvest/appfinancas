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
  // "da reserva" / "do caixa de segurança" (Empresa).
  const nome = nomeDaReserva.toLowerCase();
  const daReserva = `${nome.startsWith("caixa") ? "do" : "da"} ${nome}`;
  // Uma linha com palavra e um botão (06/10/2026), no lugar do cartão amarelo de quatro linhas que
  // abria a Carteira antes do total. Fica na tela da reserva e no Por Objetivo, onde se resolve.
  return (
    // A ação vai embaixo do texto: ao lado, ela espremia a frase em cinco linhas no celular.
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <Scale size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
      <p className="text-sm text-ink-muted">
        {naCarteira > 0 ? (
          <>
            A carteira diz <b className="font-semibold text-ink">{money(naCarteira)}</b>, a tela {daReserva} diz{" "}
            <b className="font-semibold text-ink">{money(naTelaDaReserva)}</b>.
          </>
        ) : (
          <>
            A tela {daReserva} diz <b className="font-semibold text-ink">{money(naTelaDaReserva)}</b>, mas nenhum ativo está marcado como {nome}.
          </>
        )}
      </p>
      {naCarteira > 0 ? (
        <form action={usarReservaDaCarteiraAction}>
          <button type="submit" className="min-h-9 rounded-full bg-pill px-3.5 text-sm font-semibold text-on-pill">
            Usar {money(naCarteira)}
          </button>
        </form>
      ) : (
        // Nada marcado como reserva: o caminho é marcar o ativo certo na lista da Carteira.
        <Link href="/carteira" className="text-sm font-medium text-accent-strong hover:underline">
          Marcar na Carteira
        </Link>
      )}
      </div>
    </div>
  );
}
