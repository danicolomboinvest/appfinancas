import { NextResponse } from "next/server";

export type ChamadaDoCron = "ok" | "sem-segredo" | "negado";

/**
 * Quem chamou é o agendador da Vercel? Só com o CRON_SECRET: a Vercel manda sozinha o
 * `Authorization: Bearer <segredo>` quando a variável existe no projeto.
 *
 * Antes, sem o segredo configurado, bastava um user-agent começando com "vercel-cron" — e isso
 * qualquer um forja. O dryRun dos avisos devolvia o e-mail de cada cliente com os avisos de
 * orçamento dela, e a checagem de importação disparava mensagens no ManyChat. Agora é como o
 * webhook da Hubla: sem segredo, ninguém passa (fail-closed), e o 503 deixa claro que o que
 * falta é configuração, não permissão.
 */
export function checarChamadaDoCron(authorization: string | null, segredo: string | undefined): ChamadaDoCron {
  if (!segredo) return "sem-segredo";
  return authorization === `Bearer ${segredo}` ? "ok" : "negado";
}

/** Resposta de recusa pronta pra rota devolver, ou null quando a chamada é mesmo do cron. */
export function recusarSeNaoForCron(request: Request): NextResponse | null {
  const resultado = checarChamadaDoCron(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (resultado === "ok") return null;
  if (resultado === "sem-segredo") {
    console.error("[cron] CRON_SECRET não configurado: rota recusada.", new URL(request.url).pathname);
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
