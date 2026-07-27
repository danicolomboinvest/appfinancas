"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  addAllowedEmails,
  removeAllowedEmail,
  setAllowedEmailActive,
} from "@/lib/repositories/allowedEmail.repo";
import {
  addAllowedProductByName,
  removeAllowedProduct,
  setAllowedProductActive,
} from "@/lib/repositories/allowedProduct.repo";
import { createUserInvite, findUserByEmail, findExistingUserEmails } from "@/lib/repositories/user.repo";
import { registerSchema } from "@/lib/validations/auth.schema";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail, accessGrantedEmail } from "@/lib/email/templates";

export type AccessFormState = { error?: string; added?: number; emailed?: number };
export type ProductFormState = { error?: string; ok?: boolean };
export type InviteFormState = { error?: string; created?: { email: string; password: string } };

/** Aceita a lista colada em qualquer separador comum: quebra de linha, vírgula, ponto-e-vírgula ou espaço. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function addEmailsAction(_prev: AccessFormState, formData: FormData): Promise<AccessFormState> {
  await requireAdmin();

  const raw = typeof formData.get("emails") === "string" ? (formData.get("emails") as string) : "";
  const note = typeof formData.get("note") === "string" ? (formData.get("note") as string).trim() : "";

  const emails = parseEmails(raw);
  if (emails.length === 0) {
    return { error: "Cole ao menos um e-mail." };
  }
  const invalid = emails.filter((e) => !e.includes("@"));
  if (invalid.length > 0) {
    return { error: `Estes não parecem e-mails válidos: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}` };
  }

  const { affected, toNotify } = await addAllowedEmails(emails, note || undefined);

  // Avisa por e-mail quem acabou de ser liberado e ainda não tem conta ("crie sua conta com
  // este e-mail"). Melhor esforço: falha de envio não desfaz a liberação.
  const withAccount = new Set(await findExistingUserEmails(toNotify));
  const inviteTargets = toNotify.filter((e) => !withAccount.has(e));
  let emailed = 0;
  if (inviteTargets.length > 0) {
    const registerUrl = `${await baseUrl()}/register`;
    const results = await Promise.allSettled(
      inviteTargets.map((email) => {
        const { subject, html } = accessGrantedEmail({ email, registerUrl });
        return sendEmail({ to: email, subject, html });
      }),
    );
    emailed = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  }

  revalidatePath("/admin/acessos");
  return { added: affected, emailed };
}

export async function toggleAccessAction(id: string, active: boolean) {
  await requireAdmin();
  await setAllowedEmailActive(id, active);
  revalidatePath("/admin/acessos");
}

export async function removeAccessAction(id: string) {
  await requireAdmin();
  await removeAllowedEmail(id);
  revalidatePath("/admin/acessos");
}

export async function addProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";
  if (!name) return { error: "Informe o nome do produto (como aparece no Hubla)." };
  await addAllowedProductByName(name);
  revalidatePath("/admin/acessos");
  return { ok: true };
}

export async function toggleProductAction(id: string, active: boolean) {
  await requireAdmin();
  await setAllowedProductActive(id, active);
  revalidatePath("/admin/acessos");
}

export async function removeProductAction(id: string) {
  await requireAdmin();
  await removeAllowedProduct(id);
  revalidatePath("/admin/acessos");
}

/** Monta a URL absoluta do app a partir do request (funciona em localhost e na Vercel). */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Cria uma conta direto (acesso de cortesia/VIP) já com a senha que a Dani definiu no
 * formulário — ela repassa e-mail+senha pra pessoa (WhatsApp, etc.); a pessoa pode trocar
 * depois pelo fluxo normal de "esqueci minha senha". Também entra na allowlist, senão criaria
 * a conta mas não conseguiria logar.
 */
export async function inviteUserAction(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  await requireAdmin();

  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";
  const emailRaw = typeof formData.get("email") === "string" ? (formData.get("email") as string).trim() : "";
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  const parsed = registerSchema.safeParse({ name, email: emailRaw, password });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { email } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  await createUserInvite({ email, name, password: parsed.data.password });
  await addAllowedEmails([email], "Convite VIP (criado pelo admin)");

  // E-mail de boas-vindas é só um aviso ("sua conta está pronta") — nunca leva a senha, essa a
  // Dani repassa por fora. Melhor esforço: se o envio falhar, a conta continua valendo.
  try {
    const { subject, html } = welcomeEmail({ name, appUrl: `${await baseUrl()}/login` });
    await sendEmail({ to: email, subject, html });
  } catch {
    /* ignora, não bloqueia a criação por causa do e-mail */
  }

  revalidatePath("/admin/acessos");
  return { created: { email, password } };
}
