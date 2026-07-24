"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import { createUserInvite, findUserByEmail } from "@/lib/repositories/user.repo";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";

export type AccessFormState = { error?: string; added?: number };
export type ProductFormState = { error?: string; ok?: boolean };
export type InviteFormState = { error?: string; sent?: boolean; fallbackUrl?: string };

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

  const added = await addAllowedEmails(emails, note || undefined);
  revalidatePath("/admin/acessos");
  return { added };
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
 * Cria uma conta direto (acesso de cortesia/VIP), sem senha definida por ninguém: gera um
 * link de "criar senha" (mesmo mecanismo de "esqueci minha senha") e manda por e-mail. A
 * pessoa também entra na allowlist, senão criaria a conta mas não conseguiria logar.
 */
export async function inviteUserAction(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  await requireAdmin();

  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";
  const emailRaw = typeof formData.get("email") === "string" ? (formData.get("email") as string).trim() : "";

  if (!name) return { error: "Informe o nome da pessoa." };
  const parsedEmail = z.string().email("E-mail inválido.").safeParse(emailRaw);
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0]?.message ?? "E-mail inválido." };
  const email = parsedEmail.data;

  const existing = await findUserByEmail(email);
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const user = await createUserInvite({ email, name });
  await addAllowedEmails([email], "Convite VIP (criado pelo admin)");

  const rawToken = await createPasswordResetToken(user.id);
  const resetUrl = `${await baseUrl()}/redefinir-senha?token=${rawToken}`;
  const { subject, html } = inviteEmail({ name, resetUrl });
  const result = await sendEmail({ to: email, subject, html });

  revalidatePath("/admin/acessos");

  if (!result.ok) {
    // Conta e acesso já existem mesmo se o e-mail falhar, só falta a pessoa saber o link.
    return {
      error: "Conta criada, mas o e-mail não pôde ser enviado. Copie o link abaixo e envie você mesma.",
      fallbackUrl: resetUrl,
    };
  }
  return { sent: true };
}
