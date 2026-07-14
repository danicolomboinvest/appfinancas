"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createUser, findUserByEmail } from "@/lib/repositories/user.repo";
import { registerSchema } from "@/lib/validations/auth.schema";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

export type RegisterState = { error?: string };

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Aceite dos Termos/Privacidade é obrigatório (LGPD) — valida também no servidor.
  if (formData.get("acceptTerms") !== "on") {
    return { error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." };
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return { error: "Já existe uma conta com este email." };
  }

  await createUser(parsed.data);

  // E-mail de boas-vindas — melhor esforço: se o envio falhar, o cadastro continua valendo.
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const { subject, html } = welcomeEmail({ name: parsed.data.name, appUrl: `${proto}://${host}/login` });
    await sendEmail({ to: parsed.data.email, subject, html });
  } catch {
    /* ignora — não bloqueia o cadastro por causa do e-mail */
  }

  redirect("/login");
}
