import { prisma } from "@/lib/db/prisma";
import type { SendEmailResult } from "@/lib/email/send";
import {
  boasVindasEmail,
  lembreteContaDia1Email,
  lembreteContaDia4Email,
  vazioDia2Email,
  vazioDia5Email,
  type EmailPronto,
} from "@/lib/email/boas-vindas";
import {
  BOAS_VINDAS_DESDE,
  CHAVE_BOAS_VINDAS,
  CHAVE_VAZIO_DIA2,
  etapaComConta,
  type EtapaComConta,
  type EtapaSemConta,
} from "@/lib/onboarding/boas-vindas";

/** Resposta dos e-mails de boas-vindas: a caixa de suporte, que a rotina das 20h lê. */
export const RESPONDER_PARA = "contato@danicolombo.com.br";

type Enviar = (params: { to: string; subject: string; html: string; replyTo?: string }) => Promise<SendEmailResult>;

export function emailSemConta(etapa: EtapaSemConta, email: string, baseUrl: string): EmailPronto {
  const registerUrl = `${baseUrl}/register`;
  return etapa === "conta-dia1" ? lembreteContaDia1Email({ email, registerUrl }) : lembreteContaDia4Email({ email, registerUrl });
}

export function emailComConta(etapa: EtapaComConta, name: string | null, baseUrl: string): EmailPronto {
  const appUrl = `${baseUrl}/mensal`;
  if (etapa === CHAVE_BOAS_VINDAS) return boasVindasEmail({ name, appUrl, guiaUrl: `${baseUrl}/guia` });
  if (etapa === CHAVE_VAZIO_DIA2) return vazioDia2Email({ name, appUrl });
  return vazioDia5Email({ name, appUrl });
}

/**
 * Manda um e-mail da trilha "criou a conta" com trava: a linha no NotificationLog entra ANTES do
 * envio (a chave é única por pessoa), então duas rodadas ao mesmo tempo, ou a página de
 * confirmação e o cron juntos, nunca mandam o mesmo e-mail duas vezes. Se o envio falha, a linha
 * sai e a próxima rodada tenta de novo.
 */
export async function enviarEtapaComConta(
  user: { id: string; email: string; name: string | null },
  etapa: EtapaComConta,
  baseUrl: string,
  enviar: Enviar,
): Promise<"enviado" | "ja-enviado" | "falhou"> {
  try {
    await prisma.notificationLog.create({ data: { userId: user.id, key: etapa } });
  } catch {
    return "ja-enviado";
  }
  const { subject, html } = emailComConta(etapa, user.name, baseUrl);
  const r = await enviar({ to: user.email, subject, html, replyTo: RESPONDER_PARA });
  if (r.ok) return "enviado";
  await prisma.notificationLog.deleteMany({ where: { userId: user.id, key: etapa } });
  return "falhou";
}

/**
 * Chamado pela página de confirmação do e-mail, logo depois de confirmar (via after()): manda as
 * boas-vindas na hora, se ainda for devido. Sem erro pra fora: e-mail que falha aqui o cron pega
 * na rodada seguinte.
 */
export async function enviarBoasVindasSeDevido(userId: string, baseUrl: string, enviar: Enviar): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt || user.emailVerifiedAt < BOAS_VINDAS_DESDE) return;
    const [enviados, lancamento] = await Promise.all([
      prisma.notificationLog.findMany({ where: { userId, key: { startsWith: CHAVE_BOAS_VINDAS } }, select: { key: true } }),
      prisma.monthlyEntry.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    const etapa = etapaComConta(
      { confirmadoEm: user.emailVerifiedAt, enviados: new Set(enviados.map((e) => e.key)), temLancamento: Boolean(lancamento) },
      new Date(),
    );
    if (etapa !== CHAVE_BOAS_VINDAS) return;
    await enviarEtapaComConta(user, etapa, baseUrl, enviar);
  } catch (err) {
    console.error("[boas-vindas] falha ao enviar na confirmação:", err);
  }
}
