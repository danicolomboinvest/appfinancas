"use server";

import { caminhoDoCadastro } from "@/lib/auth/convite-cadastro";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  addAllowedEmails,
  NOTA_DO_CONVITE_VIP,
  removeAllowedEmail,
  setAllowedEmailActive,
  setAllowedEmailExpiry,
} from "@/lib/repositories/allowedEmail.repo";
import {
  addAllowedProductByName,
  CONCESSOES,
  removeAllowedProduct,
  setAllowedProductActive,
  setAllowedProductConcede,
  type Concede,
} from "@/lib/repositories/allowedProduct.repo";
import { liberarProdutoManual, MONEY_RESET, setProdutoLiberadoAtivo } from "@/lib/repositories/produtoLiberado.repo";
import { createUserInvite, findUserByEmail, findExistingUserEmails } from "@/lib/repositories/user.repo";
import { adminInviteSchema } from "@/lib/validations/auth.schema";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail, accessGrantedEmail } from "@/lib/email/templates";

// `values` volta junto com o erro: o React 19 limpa o formulário a cada envio, e sem isso um
// único token inválido ("Maria Silva maria@x.com") apagava a lista inteira colada.
export type AccessFormState = {
  error?: string;
  added?: number;
  emailed?: number;
  keptLonger?: number;
  values?: { emails: string; note: string };
};
export type ProductFormState = { error?: string; ok?: boolean };
export type InviteFormState = {
  error?: string;
  created?: { email: string; password: string };
  values?: { name: string; email: string; password: string };
};

/** Aceita a lista colada em qualquer separador comum: quebra de linha, vírgula, ponto-e-vírgula ou espaço. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "YYYY-MM-DD" (input type="date") → meio-dia local, evita a data "voltar um dia" na
 * conversão pra UTC (mesmo golpe usado no lançamento mensal). Campo apagado = null (sem
 * prazo, como o formulário promete); campo ausente ou ilegível = undefined (não mexe no prazo
 * de quem já existia). "" nunca deve virar Invalid Date no Prisma. */
function parseExpiryDate(raw: FormDataEntryValue | null): Date | null | undefined {
  if (typeof raw !== "string") return undefined;
  if (!raw.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return new Date(`${raw}T12:00:00`);
}

export async function addEmailsAction(_prev: AccessFormState, formData: FormData): Promise<AccessFormState> {
  await requireAdmin();

  const raw = typeof formData.get("emails") === "string" ? (formData.get("emails") as string) : "";
  const note = typeof formData.get("note") === "string" ? (formData.get("note") as string).trim() : "";

  const values = { emails: raw, note };

  const emails = parseEmails(raw);
  if (emails.length === 0) {
    return { error: "Cole ao menos um e-mail.", values };
  }
  const invalid = emails.filter((e) => !e.includes("@"));
  if (invalid.length > 0) {
    return {
      error: `Estes não parecem e-mails válidos: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`,
      values,
    };
  }

  const expiresAt = parseExpiryDate(formData.get("expiresAt"));
  const { affected, toNotify, keptLonger } = await addAllowedEmails(emails, note || undefined, expiresAt);

  // Avisa por e-mail quem acabou de ser liberado e ainda não tem conta ("crie sua conta com
  // este e-mail"). Melhor esforço: falha de envio não desfaz a liberação.
  const withAccount = new Set(await findExistingUserEmails(toNotify));
  const inviteTargets = toNotify.filter((e) => !withAccount.has(e));
  let emailed = 0;
  if (inviteTargets.length > 0) {
    const base = await baseUrl();
    const results = await Promise.allSettled(
      inviteTargets.map((email) => {
        // Link com o e-mail já preenchido (e travado), igual ao da Hubla: ela não erra o e-mail.
        const { subject, html } = accessGrantedEmail({ email, registerUrl: `${base}${caminhoDoCadastro(email)}` });
        return sendEmail({ to: email, subject, html });
      }),
    );
    emailed = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  }

  revalidatePath("/admin/acessos");
  return { added: affected, emailed, keptLonger };
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

/** Renovação: define (ou remove, com raw vazio) a data-limite de acesso de um e-mail já na
 * lista — sem precisar apagar e recriar a linha. */
export async function setAccessExpiryAction(id: string, raw: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: "Data inválida." };
  const expiresAt = raw ? new Date(`${raw}T12:00:00`) : null;
  await setAllowedEmailExpiry(id, expiresAt);
  revalidatePath("/admin/acessos");
  return {};
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

/** O que o produto libera: o app inteiro ou só o Money Reset (o order bump). */
export async function setProductConcedeAction(id: string, concede: Concede) {
  await requireAdmin();
  if (!CONCESSOES.includes(concede)) return;
  await setAllowedProductConcede(id, concede);
  revalidatePath("/admin/acessos");
}

/** Libera o Money Reset na mão (cortesia, compra com outro e-mail, compra que não chegou). */
export async function addMoneyResetAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const emails = parseEmails(typeof formData.get("emails") === "string" ? (formData.get("emails") as string) : "");
  if (emails.length === 0) return { error: "Cole ao menos um e-mail." };
  const invalidos = emails.filter((e) => !e.includes("@"));
  if (invalidos.length > 0) return { error: `Estes não parecem e-mails válidos: ${invalidos.slice(0, 3).join(", ")}` };
  for (const email of emails) await liberarProdutoManual(email, MONEY_RESET);
  revalidatePath("/admin/acessos");
  return { ok: true };
}

export async function toggleMoneyResetAction(id: string, ativo: boolean) {
  await requireAdmin();
  await setProdutoLiberadoAtivo(id, ativo);
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

  // A senha volta também: é a Dani quem escolhe e ela já aparece em claro no formulário.
  const values = { name, email: emailRaw, password };

  const parsed = adminInviteSchema.safeParse({ name, email: emailRaw, password });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", values };
  const { email } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) return { error: "Já existe uma conta com este e-mail.", values };

  const expiresAt = parseExpiryDate(formData.get("expiresAt"));
  await createUserInvite({ email, name, password: parsed.data.password });
  await addAllowedEmails([email], NOTA_DO_CONVITE_VIP, expiresAt);

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
