import { Cabecalho } from "../_ajustes/Lista";
import { EsconderValores } from "../_ajustes/Interativos";

export const metadata = { title: "Privacidade · SPI Finance" };

/** Privacidade (rodada 25): esconder os valores, o mesmo olho do topo. */
export default function PrivacidadePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Privacidade" sub="O que fica à mostra neste aparelho." />
      <EsconderValores />
      <p className="px-1 text-[13px] text-ink-muted">Vale só neste aparelho.</p>
    </div>
  );
}
