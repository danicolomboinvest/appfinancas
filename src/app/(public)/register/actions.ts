"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createUser, findUserByEmail } from "@/lib/repositories/user.repo";
import { registerSchema } from "@/lib/validations/auth.schema";
import { normalizePhone } from "@/lib/phone";
import { getAllowedPhone } from "@/lib/repositories/allowedEmail.repo";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

// `values` volta junto com o erro: o React 19 limpa o formulário a cada envio, e sem isso
// "Celular inválido" aparecia com os quatro campos em branco. A senha nunca volta.
export type RegisterValues = { name: string; email: string; phone: string; acceptTerms: boolean };
export type RegisterState = { error?: string; values?: RegisterValues };

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo);
  return typeof v === "string" ? v : "";
}

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const values: RegisterValues = {
    name: texto(formData, "name"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    acceptTerms: formData.get("acceptTerms") === "on",
  };
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", values };
  }

  // Aceita qualquer formato digitado — "(11) 98765-4321", "+55 11...", só dígitos.
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return { error: "Celular inválido. Use DDD + número, ex.: (11) 98765-4321.", values };
  }

  // Aceite dos Termos/Privacidade é obrigatório (LGPD), valida também no servidor.
  if (!values.acceptTerms) {
    return { error: "É preciso aceitar os Termos de Uso e a Política de Privacidade.", values };
  }

  // Modelo freemium: qualquer e-mail cadastra (a parte de finanças pessoais é grátis). Ter
  // comprado o curso na Hubla só destrava depois a área de investimentos (ver hasPremiumAccess).
  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return { error: "Já existe uma conta com este email.", values };
  }

  // Se a compra no Hubla trouxe celular, ele vale como reserva (mas o digitado agora manda).
  const hublaPhone = await getAllowedPhone(parsed.data.email);
  await createUser({ ...parsed.data, phone: phone ?? hublaPhone ?? undefined });

  // E-mail de boas-vindas, melhor esforço: se o envio falhar, o cadastro continua valendo.
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const { subject, html } = welcomeEmail({ name: parsed.data.name, appUrl: `${proto}://${host}/login` });
    await sendEmail({ to: parsed.data.email, subject, html });
  } catch {
    /* ignora, não bloqueia o cadastro por causa do e-mail */
  }

  // ?created=1 mostra a confirmação "conta criada" no login, sem isso a pessoa caía num
  // formulário vazio sem saber se o cadastro tinha funcionado.
  redirect("/login?created=1");
}
