import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

const SALT_ROUNDS = 10;

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(input: { email: string; password: string; name: string }) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
  });
}

/**
 * Cria uma conta direto pelo admin (acesso de cortesia/VIP), sem que ninguém — nem a Dani —
 * defina ou veja a senha. O hash é de um valor aleatório descartável; a pessoa recebe por
 * e-mail um link (o mesmo mecanismo de "esqueci minha senha") pra escolher a própria senha.
 */
export async function createUserInvite(input: { email: string; name: string }) {
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
  });
}

export async function getOwnUser(ctx: AuthContext) {
  return prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
}

/** Intervalo mínimo entre atualizações de lastSeenAt, pra não escrever no banco a cada request. */
const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

/**
 * Marca que o usuário acabou de abrir o app, no máximo 1x a cada ~15min (throttle a partir do
 * lastSeenAt que já veio do getOwnUser, então sem query extra de leitura). Alimenta as métricas
 * de engajamento do relatório de admin. Best-effort: falha aqui nunca deve quebrar a página.
 */
export async function touchLastSeen(userId: string, previous: Date | null): Promise<void> {
  if (previous && Date.now() - previous.getTime() < LAST_SEEN_THROTTLE_MS) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } catch {
    /* engajamento é métrica secundária, não vale derrubar a navegação por isso */
  }
}

export async function updateOwnProfile(
  ctx: AuthContext,
  input: { name?: string; email: string; avatarUrl?: string },
) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

export async function updateOwnPreferences(ctx: AuthContext, input: { currency: string; theme: string }) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

export async function updateOwnNotificationPrefs(
  ctx: AuthContext,
  input: { notifyBudgetAlerts: boolean; notifyLateGoals: boolean },
) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

export async function getRecapDismissedMonth(ctx: AuthContext): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { recapDismissedMonth: true } });
  return user?.recapDismissedMonth ?? null;
}

/** Fecha o Resumo Mensal daquele mês (ex.: "2026-07"): não aparece de novo até o mês seguinte. */
export async function dismissRecapMonth(ctx: AuthContext, monthKey: string): Promise<void> {
  await prisma.user.update({ where: { id: ctx.userId }, data: { recapDismissedMonth: monthKey } });
}
