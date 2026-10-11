import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { Cabecalho, Cartao } from "../_ajustes/Lista";
import { CopiarEmail } from "../_ajustes/Interativos";
import { SUPORTE_EMAIL } from "../_ajustes/suporte";

export const metadata = { title: "Falar com o suporte · SPI Finance" };

/** Falar com o suporte (rodada 25): o e-mail como texto e o "Copiar". A resposta vem do app@. */
export default async function SuportePage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Falar com o suporte" sub={SUPORTE_EMAIL} />
      <Cartao>
        <p className="text-sm text-ink">Escreva para</p>
        <a href={`mailto:${SUPORTE_EMAIL}`} className="break-all text-[18px] font-medium text-ink">
          {SUPORTE_EMAIL}
        </a>
        <p className="text-[13px] text-ink-muted">Conte o que aconteceu e o e-mail da sua conta ({user.email}). A resposta vem desse mesmo endereço.</p>
        <CopiarEmail />
      </Cartao>
    </div>
  );
}
