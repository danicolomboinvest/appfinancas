"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth.schema";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Conta travada por excesso de tentativas → mensagem clara com o tempo restante,
  // em vez do genérico "email ou senha incorretos".
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { lockedUntil: true },
  });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      error: `Muitas tentativas de senha. Por segurança, aguarde ${minutes} minuto${minutes === 1 ? "" : "s"} e tente de novo.`,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/mensal",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha incorretos." };
    }
    throw error;
  }
}
