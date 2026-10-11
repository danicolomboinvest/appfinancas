import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { Cabecalho } from "../_ajustes/Lista";
import { DesligarOfertas } from "../_ajustes/Interativos";

export const metadata = { title: "Assessoria · SPI Finance" };

/**
 * Configurações › Assessoria (rodadas 34, 43 e 44): o interruptor que desliga todas as ofertas da
 * Fatos Capital e a assinatura "Fatos Capital, AI contratado EQI" uma vez, preta no claro e branca
 * no escuro. Os pedidos de contato ("Meus pedidos") entram com a área da assessoria.
 */
export default async function AssessoriaPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Assessoria" sub="Abrir conta pela Fatos Capital." />
      <DesligarOfertas desligadas={user.ofertasDesligadas} />
      <div className="mt-2 border-y border-border py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- assinatura fixa, pequena */}
        <img src="/logos/fatos-eqi.png" alt="Fatos Capital, AI contratado EQI" width={1212} height={394} className="h-7 w-auto [.dark_&]:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element -- a mesma assinatura em branco, no escuro */}
        <img src="/logos/fatos-eqi-branco.png" alt="Fatos Capital, AI contratado EQI" width={1212} height={394} className="hidden h-7 w-auto [.dark_&]:block" />
      </div>
    </div>
  );
}
