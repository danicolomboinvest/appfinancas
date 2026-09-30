"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/password-reset";

export type ResetState = { error?: string; success?: boolean };

const SALT_ROUNDS = 10;
const passwordSchema = z.string().min(8, "A senha deve ter ao menos 8 caracteres.");

/**
 * Redefine a senha a partir do token do e-mail. Valida o token, troca a senha, marca o token
 * como usado, zera qualquer trava de login, confirma o e-mail e desliga os avisos no celular
 * de todos os aparelhos. Um token só serve uma vez.
 */
export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  if (password !== confirm) return { error: "As senhas não coincidem." };

  const userId = await verifyPasswordResetToken(token);
  if (!userId) return { error: "Este link é inválido ou expirou. Peça um novo em 'Esqueci minha senha'." };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    // Quem abriu o link recebeu o e-mail: isso também prova que o endereço é dela. Sem isso,
    // uma conta criada antes da confirmação e recuperada pela dona continuava trancada.
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() },
  });
  // Trocar a senha já derruba as sessões abertas (ver sessao.ts), mas a inscrição de avisos no
  // celular é outra coisa: quem tinha criado a conta com o e-mail dela (ou pegado o aparelho)
  // continuava recebendo os avisos de orçamento, com valores. Quem é a dona liga de novo.
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  await consumePasswordResetToken(token);

  return { success: true };
}
