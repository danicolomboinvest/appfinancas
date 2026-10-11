import "server-only";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { sendEmail } from "@/lib/email/send";
import { SUPORTE_EMAIL } from "@/app/(app)/configuracoes/_ajustes/suporte";
import type { EmailPronto } from "./emails";
import { podeReceberEmail } from "./presente";

/** O endereço do app nos e-mails (produção; a prévia da Vercel pede login). */
export const URL_DO_APP = (process.env.EMAIL_ASSETS_URL ?? "https://financas.danicolombo.com.br").replace(/\/+$/, "");

/** Para quem o e-mail vai: nome, tema do perfil que abre ao entrar, e se ainda pode receber. */
export async function destinatario(userId: string, agora: Date = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) return null;
  const [perfil, acesso] = await Promise.all([
    prisma.financialProfile.findFirst({ where: { userId, isDefault: true }, select: { theme: true } }),
    prisma.allowedEmail.findUnique({ where: { email: normalizeEmail(user.email) }, select: { active: true, canceladoEm: true, expiresAt: true } }),
  ]);
  return { email: user.email, nome: user.name, tema: perfil?.theme ?? null, podeReceber: podeReceberEmail(acesso, agora) };
}

/**
 * Manda o e-mail do fluxo e grava a trava no pedido (sai uma vez só). Nunca para quem cancelou ou
 * pediu reembolso. Sem SMTP (local), o envio só vai para o log e o pedido não é marcado.
 */
export async function enviarDoPedido(pedidoId: string, para: { email: string; podeReceber: boolean }, email: EmailPronto): Promise<boolean> {
  if (!para.podeReceber) return false;
  const marcado = await prisma.pedidoAntesDeCancelar.updateMany({ where: { id: pedidoId, emailEnviadoEm: null }, data: { emailEnviadoEm: new Date() } });
  if (marcado.count === 0) return false; // outro envio já pegou este pedido
  const r = await sendEmail({ to: para.email, subject: email.subject, html: email.html, replyTo: SUPORTE_EMAIL });
  if (!r.ok) await prisma.pedidoAntesDeCancelar.update({ where: { id: pedidoId }, data: { emailEnviadoEm: null } });
  return r.ok;
}
