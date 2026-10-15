import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { atualizarPrecosDoTesouro, atualizarTaxasDoBancoCentral } from "@/lib/indicadores/indicadores";
import { atualizarSeries } from "@/lib/indicadores/series";
import { recalcularRendaFixaDeTodos } from "@/lib/portfolio/atualizar-renda-fixa";

// O arquivo do Tesouro tem cerca de 15 MB: a busca leva de 10 a 20 segundos.
export const maxDuration = 60;
// O recálculo da renda fixa para de pegar lote novo aqui, com folga para gravar o que começou.
const PRAZO_MS = 48_000;

/**
 * Cron diário (vercel.json): CDI, IPCA e Selic do Banco Central e o preço e a taxa de cada título
 * do Tesouro Direto (Tesouro Transparente), com a fonte e a hora. Uma fonte que falha não apaga
 * nada: a tela continua com o último valor e diz "de ontem".
 *
 * Depois (15/10/2026): os dias novos das séries do CDI e do IPCA (SerieIndice) e o rendimento de
 * toda renda fixa e Tesouro (Asset.currentValue), em lotes, os mais velhos primeiro. O que não
 * coube no prazo fica para a abertura da Carteira ou para amanhã.
 */
export async function GET(request: Request) {
  const inicio = Date.now();
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;
  const [bancoCentral, tesouro, series] = await Promise.all([atualizarTaxasDoBancoCentral(), atualizarPrecosDoTesouro(), atualizarSeries()]);
  const rendaFixa = await recalcularRendaFixaDeTodos({ prazo: inicio + PRAZO_MS }).catch((e: unknown) => ({ falhou: e instanceof Error ? e.message : "erro" }));
  return NextResponse.json({ bancoCentral, tesouro, series, rendaFixa });
}
