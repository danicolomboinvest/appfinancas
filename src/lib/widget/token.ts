import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * A chave do widget do iPhone (11/10/2026).
 *
 * O widget roda fora do app, numa extensão que não tem o cookie da sessão (nem deve ter). Ele
 * recebe uma chave própria, que só abre GET /api/widget: os números da tela inicial, nada mais.
 * Não entra em nenhuma outra rota, não muda nada, e some quando ela sai da conta ou o aparelho
 * pede outra. No banco vai só o hash: quem lê o banco não consegue usar a chave.
 */

export const PREFIXO_DA_CHAVE = "spiw_";

export function gerarChave(): string {
  return PREFIXO_DA_CHAVE + randomBytes(32).toString("base64url");
}

export function hashDaChave(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

/** Só aceita o formato que a gente gera: barra lixo antes de tocar no banco. */
export function chaveBemFormada(chave: string | null | undefined): chave is string {
  return typeof chave === "string" && /^spiw_[A-Za-z0-9_-]{43}$/.test(chave);
}

/** "Bearer spiw_..." → a chave, ou null. */
export function chaveDoCabecalho(authorization: string | null): string | null {
  const m = authorization?.match(/^Bearer\s+(\S+)$/i);
  return m && chaveBemFormada(m[1]) ? m[1] : null;
}

/** O id do aparelho que o app sorteia (uuid ou parecido). */
export function aparelhoValido(aparelho: unknown): aparelho is string {
  return typeof aparelho === "string" && /^[A-Za-z0-9-]{8,64}$/.test(aparelho);
}

/**
 * Gera a chave deste aparelho. A que ele tinha antes deixa de valer na mesma transação: um
 * aparelho tem uma chave viva por vez.
 */
export async function criarChaveDoWidget(userId: string, aparelho: string): Promise<string> {
  const chave = gerarChave();
  await prisma.$transaction([
    prisma.tokenDoWidget.updateMany({ where: { userId, aparelho, revogadoEm: null }, data: { revogadoEm: new Date() } }),
    prisma.tokenDoWidget.create({ data: { userId, aparelho, hash: hashDaChave(chave) } }),
  ]);
  return chave;
}

/** De quem é a chave, se ela ainda vale. Marca o uso (no máximo uma escrita a cada 30 min). */
export async function donoDaChave(chave: string): Promise<string | null> {
  const token = await prisma.tokenDoWidget.findUnique({ where: { hash: hashDaChave(chave) }, select: { id: true, userId: true, revogadoEm: true, usadoEm: true } });
  if (!token || token.revogadoEm) return null;
  if (!token.usadoEm || Date.now() - token.usadoEm.getTime() > 30 * 60_000) {
    await prisma.tokenDoWidget.update({ where: { id: token.id }, data: { usadoEm: new Date() } }).catch(() => {});
  }
  return token.userId;
}

/** Revoga uma chave (o próprio app pede, ao sair da conta). */
export async function revogarChave(chave: string): Promise<void> {
  await prisma.tokenDoWidget.updateMany({ where: { hash: hashDaChave(chave), revogadoEm: null }, data: { revogadoEm: new Date() } });
}

/** Revoga todas as chaves da conta (ex.: "desligar o widget em todos os aparelhos"). */
export async function revogarTodasAsChaves(userId: string): Promise<number> {
  const r = await prisma.tokenDoWidget.updateMany({ where: { userId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  return r.count;
}
