import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { getExchangeRate } from "@/lib/fx/rates";
import { formatMoney } from "@/lib/money";
import { Cabecalho, Grupo } from "../_ajustes/Lista";
import { AjustesRapidos } from "../_ajustes/AjustesRapidos";

export const metadata = { title: "Moeda e dólar · SPI Finance" };

/**
 * Moeda e dólar (protótipo, #configuracoes-moeda): a moeda em pílulas ("Só o símbolo muda"), o
 * dólar de hoje que converte o exterior da Carteira e a nota de quem tem só uma parte fora.
 */
export default async function MoedaPage() {
  const ctx = await getRequiredSession();
  const [user, dolar] = await Promise.all([getOwnUser(ctx), getExchangeRate("USD", "BRL").catch(() => null)]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Cabecalho titulo="Moeda e dólar" />
      <Grupo>
        <AjustesRapidos so="moeda" moeda={user.currency} modo={user.theme} podeEscolherModo={false} rotulos={{ modo: "", claro: "", escuro: "", moeda: "Moeda", moedaAviso: "Só o símbolo muda: os números ficam iguais." }} />
      </Grupo>
      {dolar && (
        <div className="flex min-h-16 items-center gap-3 rounded-3xl bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-border)]" data-dolar-de-hoje>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-medium text-ink">Dólar de hoje</b>
            <small className="text-[13px] text-ink-muted">Banco Central · converte o exterior da Carteira</small>
          </span>
          <em className="shrink-0 not-italic tabular-nums text-ink">{formatMoney(dolar.rate, "BRL")}</em>
        </div>
      )}
      <p className="px-1 text-[13px] text-ink-muted">Só uma parte em outra moeda? Deixe a principal aqui e escolha a moeda ao lançar.</p>
    </div>
  );
}
