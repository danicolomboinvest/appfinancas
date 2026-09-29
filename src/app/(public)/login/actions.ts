"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth.config";
import { findUserByEmail } from "@/lib/repositories/user.repo";
import { loginSchema } from "@/lib/validations/auth.schema";
import { destinoDepoisDoLogin } from "@/lib/auth/sessao";

// `email` volta junto com o erro: o React 19 limpa o formulário a cada envio, e sem isso cada
// senha errada apagava também o e-mail digitado.
export type LoginState = { error?: string; email?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = typeof formData.get("email") === "string" ? (formData.get("email") as string) : "";

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", email };
  }

  // Conta travada por excesso de tentativas → mensagem clara com o tempo restante,
  // em vez do genérico "email ou senha incorretos".
  const user = await findUserByEmail(parsed.data.email);
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      error: `Muitas tentativas de senha. Por segurança, aguarde ${minutes} minuto${minutes === 1 ? "" : "s"} e tente de novo.`,
      email,
    };
  }

  // Modelo freemium: login não depende mais de ter acesso premium (isso só é checado dentro
  // das telas de investimento). Não ter comprado o curso não impede logar.
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      // Volta pra tela que a trouxe até aqui (ex.: "Desativar notificações" do e-mail abriu
      // deslogada); sem callbackUrl, ou com um destino fora do app, cai no Foco.
      redirectTo: destinoDepoisDoLogin(formData.get("callbackUrl")),
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha incorretos.", email };
    }
    throw error;
  }
}
