import { prisma } from "@/lib/db/prisma";
import { normalizeEmail, NOTA_DO_CONVITE_VIP } from "@/lib/repositories/allowedEmail.repo";

/**
 * Saída sem reembolso (customer.member_removed), decisão da Dani em 11/10: o app NÃO tira o acesso
 * na hora. Quem cancelou já pagou até o vencimento e fica até lá; o cron desliga depois. Só o
 * reembolso (invoice.refunded) corta na hora (revokeFromHubla).
 *
 * Puro: o que fazer com a liberação. "manter" = marca canceladoEm e deixa ativa até o prazo;
 * "desligar" = sem prazo futuro (vencida ou sem data), desliga já, como antes.
 */
export function decidirSaida(entry: { active: boolean; expiresAt: Date | null }, agora: Date): "manter" | "desligar" | "nada" {
  if (!entry.active) return "nada";
  return entry.expiresAt && entry.expiresAt.getTime() > agora.getTime() ? "manter" : "desligar";
}

/** Quem a saída pode mexer: o mesmo filtro do revokeFromHubla (veio da Hubla e não é VIP). */
function daHubla(e: { source: string; lastHublaInvoiceId: string | null; note: string | null }): boolean {
  if (e.note?.startsWith(NOTA_DO_CONVITE_VIP)) return false;
  return e.source === "HUBLA" || e.lastHublaInvoiceId !== null;
}

export async function encerrarNoVencimento(email: string, agora: Date = new Date()): Promise<"manter" | "desligar" | "nada"> {
  const entry = await prisma.allowedEmail.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, active: true, expiresAt: true, source: true, lastHublaInvoiceId: true, note: true },
  });
  if (!entry || !daHubla(entry)) return "nada";
  const decisao = decidirSaida(entry, agora);
  if (decisao === "manter") await prisma.allowedEmail.update({ where: { id: entry.id }, data: { canceladoEm: agora } });
  if (decisao === "desligar") await prisma.allowedEmail.update({ where: { id: entry.id }, data: { active: false, canceladoEm: agora } });
  return decisao;
}

/** O cron: quem cancelou e cujo prazo já passou é desligado (o login já barrava pelo prazo). */
export async function desligarCanceladosVencidos(agora: Date = new Date()): Promise<number> {
  const r = await prisma.allowedEmail.updateMany({ where: { active: true, canceladoEm: { not: null }, expiresAt: { lt: agora } }, data: { active: false } });
  return r.count;
}
