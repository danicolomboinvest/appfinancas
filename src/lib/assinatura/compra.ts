import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";

export type Compra = { em: Date; via: "apple" | "site" };

/**
 * Onde e quando a pessoa comprou o app: a assinatura da Apple ativa (comprou pelo iPhone) ou a
 * liberação que veio da Hubla (comprou pelo site). Liberação manual da Dani não é compra: null.
 */
export async function compraDoApp(userId: string, email: string): Promise<Compra | null> {
  const [apple, hubla] = await Promise.all([
    prisma.assinaturaApple.findFirst({ where: { userId, revogadaEm: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.allowedEmail.findUnique({ where: { email: normalizeEmail(email) }, select: { createdAt: true, source: true, active: true } }),
  ]);
  if (apple) return { em: apple.createdAt, via: "apple" };
  if (hubla && hubla.active && hubla.source === "HUBLA") return { em: hubla.createdAt, via: "site" };
  return null;
}
