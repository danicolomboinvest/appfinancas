"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  addAllowedEmails,
  removeAllowedEmail,
  setAllowedEmailActive,
} from "@/lib/repositories/allowedEmail.repo";

export type AccessFormState = { error?: string; added?: number };

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
