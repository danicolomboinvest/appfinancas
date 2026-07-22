"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";

export type ForgotState = { sent?: boolean; error?: string };

const emailSchema = z.string().email("Email inválido.");

/** Monta a URL absoluta do app a partir do request (funciona em localhost e na Vercel). */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Recebe o e-mail e, se existir uma conta, envia o link de redefinição. A resposta é SEMPRE a
 * mesma (sucesso), exista a conta ou não, assim ninguém descobre quais e-mails têm cadastro.
 */
export async function requestPasswordResetAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Email inválido." };

  const email = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });

  if (user) {
    const rawToken = await createPasswordResetToken(user.id);
    const resetUrl = `${await baseUrl()}/redefinir-senha?token=${rawToken}`;
    const { subject, html } = passwordResetEmail({ name: user.name, resetUrl });
    await sendEmail({ to: email, subject, html }); // falha de envio não vaza se a conta existe
  }

  return { sent: true };
}
