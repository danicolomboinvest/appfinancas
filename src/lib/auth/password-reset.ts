import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/** Guardamos só o hash, quem tiver acesso ao banco não consegue montar o link de reset. */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Cria um token de recuperação para o usuário e devolve o valor CRU (que vai no link do
 * e-mail). Invalida tokens anteriores do mesmo usuário, só o último link vale.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return rawToken;
}

/**
 * Valida um token cru: retorna o userId se estiver válido (existe, não expirou, não foi usado),
 * senão null. NÃO marca como usado, isso acontece só quando a senha é de fato trocada.
 */
export async function verifyPasswordResetToken(rawToken: string): Promise<string | null> {
  if (!rawToken) return null;
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!token || token.usedAt || token.expiresAt < new Date()) return null;
  return token.userId;
}

/** Marca o token como usado (chamado dentro da troca de senha). */
export async function consumePasswordResetToken(rawToken: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { tokenHash: hashToken(rawToken) },
    data: { usedAt: new Date() },
  });
}
