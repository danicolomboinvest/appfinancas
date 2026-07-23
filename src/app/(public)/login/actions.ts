"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { isEmailAllowed } from "@/lib/repositories/allowedEmail.repo";
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
    select: { lockedUntil: true, role: true },
  });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      error: `Muitas tentativas de senha. Por segurança, aguarde ${minutes} minuto${minutes === 1 ? "" : "s"} e tente de novo.`,
    };
  }

  // Acesso revogado (reembolso / assinatura cancelada): mensagem clara em vez do genérico
  // "email ou senha incorretos". A trava de verdade fica no authorize() do next-auth; aqui
  // é só UX. ADMIN nunca é bloqueada.
  if (user && user.role !== "ADMIN" && !(await isEmailAllowed(parsed.data.email))) {
    return { error: "Seu acesso não está ativo no momento. Fale com o suporte para regularizar." };
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
