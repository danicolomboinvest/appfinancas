import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";

/**
 * O id da assinatura na Hubla, para o link direto do painel (os 2 meses grátis do "antes de
 * cancelar": a Dani anda a cobrança 60 dias com um toque). O webhook não guardava; passa a guardar
 * no próximo evento de pagamento. Lê os jeitos que o payload pode trazer, sem quebrar se não vier.
 */
export function extrairIdDaAssinatura(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  const sub = e.subscription as Record<string, unknown> | undefined;
  const inv = e.invoice as Record<string, unknown> | undefined;
  const invSub = inv?.subscription as Record<string, unknown> | undefined;
  for (const id of [sub?.id, inv?.subscriptionId, invSub?.id, e.subscriptionId]) {
    if (typeof id === "string" && /^[\w-]{4,80}$/.test(id)) return id;
  }
  return null;
}

export async function guardarIdDaAssinatura(emails: string[], event: unknown): Promise<void> {
  const id = extrairIdDaAssinatura(event);
  if (!id) return;
  await prisma.allowedEmail.updateMany({ where: { email: { in: emails.map(normalizeEmail) } }, data: { hublaSubscriptionId: id } });
}

/** O link do painel: direto na assinatura, ou a busca pelo e-mail quando o id ainda não veio. */
export function linkDaAssinaturaNaHubla(subscriptionId: string | null, email: string): string {
  if (subscriptionId) return `https://app.hub.la/dashboard/subscriptions/${encodeURIComponent(subscriptionId)}`;
  return `https://app.hub.la/dashboard/subscriptions?search=${encodeURIComponent(email)}&tab=subscriptions`;
}
