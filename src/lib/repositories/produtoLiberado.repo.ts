import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";

/**
 * O que a pessoa comprou além do app (05/10/2026): hoje só o Money Reset, vendido no order bump
 * do SPI Finance. Fica no e-mail da compra, como a lista de acesso do app, porque a compra chega
 * pela Hubla antes de a conta existir.
 *
 * A liberação da Hubla e a manual da Dani moram na mesma linha (um e-mail, um produto): o
 * reembolso só desliga o que veio da Hubla, igual ao acesso do app (ver revokeFromHubla).
 */

export type Produto = "money_reset";
export const MONEY_RESET: Produto = "money_reset";

export async function liberarProdutoDaHubla(email: string, produto: Produto) {
  const e = normalizeEmail(email);
  return prisma.produtoLiberado.upsert({
    where: { email_produto: { email: e, produto } },
    create: { email: e, produto, origem: "hubla", ativo: true },
    // Quem já tinha a liberação manual continua "manual": o reembolso dessa compra não tira o
    // que a Dani deu na mão.
    update: { ativo: true },
  });
}

/** Reembolso ou perda do produto na Hubla: desliga só o que veio da Hubla. */
export async function revogarProdutoDaHubla(email: string, produto: Produto) {
  return prisma.produtoLiberado.updateMany({ where: { email: normalizeEmail(email), produto, origem: "hubla" }, data: { ativo: false } });
}

/** Liberação na mão (painel de acessos): cortesia, troca de e-mail, compra que não chegou. */
export async function liberarProdutoManual(email: string, produto: Produto) {
  const e = normalizeEmail(email);
  return prisma.produtoLiberado.upsert({
    where: { email_produto: { email: e, produto } },
    create: { email: e, produto, origem: "manual", ativo: true },
    update: { ativo: true, origem: "manual" },
  });
}

export async function setProdutoLiberadoAtivo(id: string, ativo: boolean) {
  return prisma.produtoLiberado.update({ where: { id }, data: { ativo } });
}

export async function listarProdutosLiberados(produto: Produto) {
  return prisma.produtoLiberado.findMany({ where: { produto }, orderBy: [{ ativo: "desc" }, { createdAt: "desc" }] });
}

export async function temProduto(email: string, produto: Produto): Promise<boolean> {
  return (await prisma.produtoLiberado.count({ where: { email: normalizeEmail(email), produto, ativo: true } })) > 0;
}

/**
 * A pessoa logada tem o Money Reset? A Dani (ADMIN) sempre vê, pra conferir o que vende. Quem não
 * comprou nunca vê nada dele no app: foi decisão dela, pra ninguém se sentir cobrado lá dentro.
 */
export async function temMoneyReset(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return temProduto(user.email, MONEY_RESET);
}
