import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

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
