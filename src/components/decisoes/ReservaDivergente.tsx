import Link from "next/link";
import { usarReservaDaCarteiraAction } from "@/app/(app)/planejamento/reserva-emergencia/actions";

/**
 * A reserva mora em dois lugares: o valor que a pessoa digitou na tela da reserva e os
 * investimentos marcados como "reserva" na Carteira. Quando os dois não batem, o app avisa em
 * vez de mostrar números diferentes em telas diferentes — e oferece o caminho pra alinhar.
 *
 * `onde` diz em qual tela o aviso está, pra o link apontar pra OUTRA.
 */
export function ReservaDivergente({
  naTelaDaReserva,
  naCarteira,
  temInvestimentos,
  nomeDaReserva,
  onde,
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
  const outraTela =
    onde === "reserva" ? (
      <Link href="/carteira" className="text-sm font-medium text-accent-strong hover:underline">
        Corrigir na Carteira
      </Link>
    ) : (
      <Link href="/planejamento/reserva-emergencia" className="text-sm font-medium text-accent-strong hover:underline">
        Corrigir na tela {daReserva}
      </Link>
    );

  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-5">
      <p className="text-base font-semibold text-ink">Os valores {daReserva} não batem</p>
      {naCarteira > 0 ? (
        <p className="text-sm leading-relaxed text-ink-muted">
          Na tela {daReserva} está <b className="text-ink">{money(naTelaDaReserva)}</b>. Na Carteira, os
          investimentos marcados como reserva somam <b className="text-ink">{money(naCarteira)}</b>. Qual está certo?
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-ink-muted">
          Na tela {daReserva} está <b className="text-ink">{money(naTelaDaReserva)}</b>, mas nenhum
          investimento da Carteira está marcado como reserva. Marque lá onde esse dinheiro está guardado (CDB, Tesouro Selic, conta que rende) pra os números baterem.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {naCarteira > 0 && (
          <form action={usarReservaDaCarteiraAction}>
            <button type="submit" className="rounded-full bg-pill px-4 py-2 text-sm font-semibold text-on-pill">
              Usar o da Carteira ({money(naCarteira)})
            </button>
          </form>
        )}
        {naCarteira > 0 ? outraTela : (
          <Link href="/carteira" className="text-sm font-medium text-accent-strong hover:underline">
            Marcar na Carteira
          </Link>
        )}
      </div>
    </div>
  );
}
