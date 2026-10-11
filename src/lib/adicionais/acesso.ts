import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { temProduto } from "@/lib/repositories/produtoLiberado.repo";
import { ADICIONAIS, inicioDaCobranca, type Adicional } from "./config";

export type SituacaoDoAdicional = {
  /** Dia em que a cobrança começa; null = desligada. */
  cobrancaDesde: Date | null;
  agora: Date;
  admin: boolean;
  contaCriadaEm: Date;
  /** Quando o e-mail ganhou acesso ao app pela primeira vez (compra na Hubla, Apple ou a Dani). */
  acessoDesde: Date | null;
  /** Liberado na lista de produtos (compra na Hubla ou liberação na mão da Dani). */
  pagoNaHubla: boolean;
  /** Assinatura da Apple deste adicional, sem reembolso e dentro do prazo. */
  pagoNaApple: boolean;
};

/**
 * Se a pessoa tem o adicional agora. Antes do lançamento todo mundo tem. Depois, tem quem pagou
 * (Hubla, Apple ou liberação da Dani) e quem já era cliente antes do lançamento: essas pessoas
 * compraram quando o plano dizia "pessoal, casal e empresa", e tirar isso delas seria vender de
 * novo o que já foi vendido.
 */
export function decidirAdicional(s: SituacaoDoAdicional): boolean {
  if (!s.cobrancaDesde || s.agora < s.cobrancaDesde) return true;
  if (s.admin) return true;
  if (s.contaCriadaEm < s.cobrancaDesde) return true;
  if (s.acessoDesde && s.acessoDesde < s.cobrancaDesde) return true;
  return s.pagoNaHubla || s.pagoNaApple;
}

export async function temAdicional(userId: string, adicional: Adicional, agora: Date = new Date()): Promise<boolean> {
  const cobrancaDesde = inicioDaCobranca();
  if (!cobrancaDesde || agora < cobrancaDesde) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true, createdAt: true } });
  if (!user) return false;
  const [liberacao, pagoNaHubla, apple] = await Promise.all([
    prisma.allowedEmail.findUnique({ where: { email: normalizeEmail(user.email) }, select: { createdAt: true } }),
    temProduto(user.email, adicional),
    prisma.assinaturaApple.count({ where: { userId, productId: ADICIONAIS[adicional].apple, revogadaEm: null, expiresAt: { gt: agora } } }),
  ]);
  return decidirAdicional({
    cobrancaDesde,
    agora,
    admin: user.role === "ADMIN",
    contaCriadaEm: user.createdAt,
    acessoDesde: liberacao?.createdAt ?? null,
    pagoNaHubla,
    pagoNaApple: apple > 0,
  });
}
