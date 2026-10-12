import { Cabecalho } from "../_ajustes/Lista";
import { EsconderValores } from "../_ajustes/Interativos";

export const metadata = { title: "Privacidade · SPI Finance" };

/** Privacidade (rodada 25): esconder os valores, o mesmo olho do topo. */
export default function PrivacidadePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Privacidade" sub="O que fica à mostra neste aparelho." />
      <EsconderValores />
      {/* O bloqueio com Face ID ou código é do app de iPhone e Android; ainda não está no ar. */}
      <div className="flex min-h-14 items-center justify-between gap-3 rounded-3xl bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="min-w-0">
          <b className="block text-[15px] font-normal text-ink-muted">Bloqueio com Face ID ou código</b>
          <small className="text-[13px] text-ink-faint">Ao abrir o app.</small>
        </span>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">em breve</span>
      </div>
      <p className="px-1 text-[13px] text-ink-muted">Vale só neste aparelho.</p>
    </div>
  );
}
