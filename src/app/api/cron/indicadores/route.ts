import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { atualizarPrecosDoTesouro, atualizarTaxasDoBancoCentral } from "@/lib/indicadores/indicadores";

// O arquivo do Tesouro tem cerca de 15 MB: a busca leva de 10 a 20 segundos.
export const maxDuration = 60;

/**
 * Cron diário (vercel.json): CDI, IPCA e Selic do Banco Central e o preço e a taxa de cada título
 * do Tesouro Direto (Tesouro Transparente), com a fonte e a hora. Uma fonte que falha não apaga
 * nada: a tela continua com o último valor e diz "de ontem".
 */
export async function GET(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;
  const [bancoCentral, tesouro] = await Promise.all([atualizarTaxasDoBancoCentral(), atualizarPrecosDoTesouro()]);
  return NextResponse.json({ bancoCentral, tesouro });
}
