import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { prisma } from "@/lib/db/prisma";
import { abrirEnvioEmLote } from "@/lib/email/send";
import {
  BOAS_VINDAS_DESDE,
  CHAVE_BOAS_VINDAS,
  PRAZO_COM_CONTA_DIAS,
  PRAZO_SEM_CONTA_DIAS,
  etapaComConta,
  etapaSemConta,
  type EtapaSemConta,
} from "@/lib/onboarding/boas-vindas";
import { emailSemConta, enviarEtapaComConta, RESPONDER_PARA } from "@/lib/onboarding/enviar-boas-vindas";

export const maxDuration = 300;
const PRAZO_MS = 270_000;
const DIA_MS = 86_400_000;
/** Quem comprou antes das boas-vindas e nunca criou a conta: até onde o `atrasados` olha. */
const ATRASADOS_DIAS = 60;

/**
 * Boas-vindas, uma rodada por dia (plano Hobby da Vercel: agendamento diário, ver o comentário
 * do monthly-recap). As regras de quem recebe o quê estão em src/lib/onboarding/boas-vindas.ts.
 *
 *  - ?dryRun=1       conta o que SERIA enviado, sem enviar;
 *  - ?onlyEmail=x    só essa pessoa (teste antes de valer pra todo mundo);
 *  - ?atrasados=1    uma vez só, com o ok da Dani: manda o lembrete do 4º dia pra quem comprou
 *                    ANTES das boas-vindas existirem e nunca criou a conta. O agendamento nunca
 *                    passa esse parâmetro.
 *
 * A trilha "sem conta" é só de quem COMPROU (source HUBLA): o texto diz "você garantiu o SPI
 * Finance", o que não vale pra acesso que a Dani liberou na mão.
 */
export async function GET(request: Request) {
  const inicio = Date.now();
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const onlyEmail = url.searchParams.get("onlyEmail")?.trim().toLowerCase();
  const atrasados = url.searchParams.get("atrasados") === "1";
  const baseUrl = appBaseUrl(request);
  const agora = new Date();

  const contagem: Record<string, number> = {};
  const conta = (k: string) => (contagem[k] = (contagem[k] ?? 0) + 1);
  let parouPorTempo = false;
  const lote = dryRun ? null : abrirEnvioEmLote();

  try {
    // ── Trilha 1: comprou e não criou a conta ─────────────────────────────────────────────
    const desdeSemConta = atrasados
      ? new Date(agora.getTime() - ATRASADOS_DIAS * DIA_MS)
      : new Date(Math.max(BOAS_VINDAS_DESDE.getTime(), agora.getTime() - PRAZO_SEM_CONTA_DIAS * DIA_MS));
    const liberados = await prisma.allowedEmail.findMany({
      where: {
        source: "HUBLA",
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: agora } }],
        createdAt: atrasados ? { gte: desdeSemConta, lt: BOAS_VINDAS_DESDE } : { gte: desdeSemConta, lte: new Date(agora.getTime() - DIA_MS) },
        ...(atrasados ? { lembreteConta2Em: null } : {}),
        ...(onlyEmail ? { email: onlyEmail } : {}),
      },
      select: { id: true, email: true, createdAt: true, lembreteConta1Em: true, lembreteConta2Em: true },
    });
    const comConta = new Set(
      (await prisma.user.findMany({ where: { email: { in: liberados.map((l) => l.email.toLowerCase()) } }, select: { email: true } })).map((u) =>
        u.email.toLowerCase(),
      ),
    );

    for (const l of liberados) {
      if (comConta.has(l.email.toLowerCase())) continue;
      const etapa: EtapaSemConta | null = atrasados ? "conta-dia4" : etapaSemConta({ liberadoEm: l.createdAt, lembrete1Em: l.lembreteConta1Em, lembrete2Em: l.lembreteConta2Em }, agora);
      if (!etapa) continue;
      if (dryRun) {
        conta(etapa);
        continue;
      }
      if (Date.now() - inicio > PRAZO_MS) {
        parouPorTempo = true;
        break;
      }
      // Trava antes do envio: só quem conseguiu gravar a data manda. Falhou, a data volta.
      const campo = etapa === "conta-dia1" ? "lembreteConta1Em" : "lembreteConta2Em";
      const trava = await prisma.allowedEmail.updateMany({ where: { id: l.id, [campo]: null }, data: { [campo]: new Date() } });
      if (trava.count !== 1) continue;
      const { subject, html } = emailSemConta(etapa, l.email, baseUrl);
      const r = await lote!.enviar({ to: l.email, subject, html, replyTo: RESPONDER_PARA });
      if (r.ok) conta(etapa);
      else {
        await prisma.allowedEmail.update({ where: { id: l.id }, data: { [campo]: null } });
        conta(`${etapa}-falhou`);
      }
    }

    // ── Trilha 2: criou a conta (confirmada) e ainda não lançou nada ──────────────────────
    if (!atrasados && !parouPorTempo) {
      const desdeComConta = new Date(Math.max(BOAS_VINDAS_DESDE.getTime(), agora.getTime() - PRAZO_COM_CONTA_DIAS * DIA_MS));
      const usuarios = await prisma.user.findMany({
        where: { role: "CLIENT", emailVerifiedAt: { gte: desdeComConta }, ...(onlyEmail ? { email: onlyEmail } : {}) },
        select: { id: true, email: true, name: true, emailVerifiedAt: true },
      });
      const ids = usuarios.map((u) => u.id);
      const [logs, comLancamento] = await Promise.all([
        prisma.notificationLog.findMany({ where: { userId: { in: ids }, key: { startsWith: CHAVE_BOAS_VINDAS } }, select: { userId: true, key: true } }),
        prisma.monthlyEntry.groupBy({ by: ["userId"], where: { userId: { in: ids } } }),
      ]);
      const lancou = new Set(comLancamento.map((c) => c.userId));
      const enviadosPor = new Map<string, Set<string>>();
      for (const l of logs) enviadosPor.set(l.userId, (enviadosPor.get(l.userId) ?? new Set()).add(l.key));

      for (const u of usuarios) {
        const etapa = etapaComConta(
          { confirmadoEm: u.emailVerifiedAt!, enviados: enviadosPor.get(u.id) ?? new Set(), temLancamento: lancou.has(u.id) },
          agora,
        );
        if (!etapa) continue;
        if (dryRun) {
          conta(etapa);
          continue;
        }
        if (Date.now() - inicio > PRAZO_MS) {
          parouPorTempo = true;
          break;
        }
        const r = await enviarEtapaComConta(u, etapa, baseUrl, lote!.enviar);
        if (r === "enviado") conta(etapa);
        else if (r === "falhou") conta(`${etapa}-falhou`);
      }
    }
  } finally {
    lote?.fechar();
  }

  return NextResponse.json({ ok: true, dryRun, atrasados, parouPorTempo, contagem });
}

/** URL do app a partir do próprio request: localhost ou o domínio de produção. */
function appBaseUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
