"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth.config";
import { DESTINO_PADRAO } from "@/lib/auth/sessao";
import { enviarConfirmacaoDeEmail } from "@/lib/auth/enviar-confirmacao";
import { createUser, findUserByEmail } from "@/lib/repositories/user.repo";
import { registerSchema } from "@/lib/validations/auth.schema";
import { normalizePhone } from "@/lib/phone";
import { getAllowedPhone } from "@/lib/repositories/allowedEmail.repo";

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
    return { error: "Já existe uma conta com este email. Se ela é sua, use \"Esqueci minha senha\" no login pra entrar.", values };
  }

  // Se a compra no Hubla trouxe celular, ele vale como reserva (mas o digitado agora manda).
  const hublaPhone = await getAllowedPhone(parsed.data.email);
  const user = await createUser({ ...parsed.data, phone: phone ?? hublaPhone ?? undefined });

  // "Confirme seu e-mail" no lugar do antigo boas-vindas: a conta só abre (e a área paga só
  // libera) depois do clique no link, senão qualquer um se cadastrava com o e-mail de uma
  // compradora. Melhor esforço: se o envio falhar, a tela de confirmação tem o "Reenviar".
  await enviarConfirmacaoDeEmail(user).catch(() => "falhou");

  // Já entra logada: cai direto na tela "Confirme seu e-mail", que mostra pra qual endereço o
  // link foi e deixa reenviar. Se o login automático falhar por algum motivo, o login normal
  // ainda funciona (e mostra "conta criada").
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: DESTINO_PADRAO,
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error; // o redirect do signIn também chega aqui
  }
  redirect("/login?created=1");
}
