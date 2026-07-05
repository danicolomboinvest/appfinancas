import bcrypt from "bcryptjs";
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

export async function getOwnUser(ctx: AuthContext) {
  return prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
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
