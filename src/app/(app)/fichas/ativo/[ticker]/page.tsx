import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { tickerValido } from "@/lib/analysis/tipo-do-ticker";
import { AnaliseCompleta } from "../../analises/AnaliseCompleta";
import { LerEAbrir } from "../../analises/LerEAbrir";
import { montarCompleta } from "../../analises/montar-completa";

/** A Análise completa de um ticker (rodada 56). Sem leitura ainda, lê agora e abre. */
export default async function AnaliseDoAtivoPage(props: PageProps<"/fichas/ativo/[ticker]">) {
  const { ticker: bruto } = await props.params;
  const ticker = decodeURIComponent(bruto).trim().toUpperCase();
  if (!tickerValido(ticker)) notFound();
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const p = await montarCompleta(ctx, ticker, money);
  if (!p) return <LerEAbrir ticker={ticker} />;
  return <AnaliseCompleta {...p} />;
}
