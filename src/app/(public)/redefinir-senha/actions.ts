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
 * como usado e zera qualquer trava de login. Um token só serve uma vez.
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
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  await consumePasswordResetToken(token);

  return { success: true };
}
