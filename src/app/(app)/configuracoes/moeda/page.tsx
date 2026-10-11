import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { currencySymbol } from "@/lib/money";
import { Cabecalho, Cartao, Grupo } from "../_ajustes/Lista";
import { AjustesRapidos } from "../_ajustes/AjustesRapidos";

export const metadata = { title: "Moeda e dólar · SPI Finance" };

/** Moeda e dólar (rodada 25): só o símbolo muda; o exterior aparece em US$ com o valor em reais ao lado. */
export default async function MoedaPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Moeda e dólar" sub="Como o app mostra o que está fora do Brasil." />
      <Grupo>
        <AjustesRapidos
          so="moeda"
          moeda={user.currency}
          modo={user.theme}
          podeEscolherModo={false}
          rotulos={{ modo: "", claro: "", escuro: "", moeda: "Moeda", moedaAviso: `Só o símbolo muda: ${currencySymbol("BRL")} 3.000 vira ${currencySymbol("EUR")} 3.000.` }}
        />
      </Grupo>
      <Cartao>
        <b className="text-[15px] font-medium text-ink">Como o exterior é convertido</b>
        <p className="text-sm text-ink-muted">O que você tem em dólar aparece em US$, com o valor em reais ao lado, pela cotação do dia.</p>
      </Cartao>
    </div>
  );
}
