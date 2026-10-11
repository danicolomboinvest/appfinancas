import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { limparParesVencidos } from "@/lib/repositories/casal-login.repo";

export const maxDuration = 60;

/**
 * Login do par, uma vez por dia (vercel.json): marca o dia em que o Casal de uma titular parou de
 * valer, devolve o acesso de quem renovou, tira de vez o par depois de 90 dias sem renovar e
 * apaga o "só meu" de quem saiu há mais de 90 dias. O acesso do par já para na hora pelo app
 * (o layout confere a cada entrada); isto aqui só cuida dos prazos de quem não abre o app.
 */
export async function GET(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;
  const r = await limparParesVencidos();
  return NextResponse.json({ ok: true, ...r });
}
