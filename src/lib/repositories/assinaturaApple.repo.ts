import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import { prisma } from "@/lib/db/prisma";
import { IDS_DOS_PRODUTOS, tokenDaConta } from "@/lib/apple/config";
import { isExpired, normalizeEmail } from "./allowedEmail.repo";

/**
 * Assinatura comprada pela Apple dentro do app iOS (out/2026). A compra vira uma liberação no
 * AllowedEmail com source APPLE, então o resto do app (cadeado, e-mails automáticos, painel de
 * acessos) trata igual a uma compra do Hubla, sem saber de onde veio.
 */

export type LiberacaoAtual = { source: string; active: boolean; expiresAt: Date | null; lastHublaInvoiceId: string | null } | null;

/** Transação que dá acesso agora: um dos nossos produtos, sem reembolso e dentro do prazo. */
export function transacaoValendo(tx: JWSTransactionDecodedPayload, agora: Date = new Date()): boolean {
  if (!tx.productId || !IDS_DOS_PRODUTOS.includes(tx.productId)) return false;
  if (tx.revocationDate) return false;
  return typeof tx.expiresDate === "number" && tx.expiresDate > agora.getTime();
}

/**
 * Transação de ANTES de um reembolso. O recibo assinado é uma foto do dia da compra: depois do
 * reembolso ele continua "valendo" por dentro, e quem guardou uma cópia (ou um aviso velho que a
 * Apple reenvia fora de ordem) reabriria o acesso de graça. Só uma compra feita depois do
 * reembolso passa.
 */
export function anteriorAoReembolso(tx: JWSTransactionDecodedPayload, revogadaEm: Date | null): boolean {
  if (!revogadaEm) return false;
  return (tx.purchaseDate ?? 0) <= revogadaEm.getTime();
}

/**
 * O que a compra pela Apple faz com a liberação do e-mail. `null` = não mexe.
 * Quem já tem acesso valendo por outro caminho (Hubla, liberação da Dani) não é tocado: a
 * assinatura fica registrada, mas o prazo que vale é o que ela já tinha.
 */
export function decidirLiberacaoApple(atual: LiberacaoAtual, expiraEm: Date, agora: Date = new Date()): { expiresAt: Date } | null {
  const valendo = atual && atual.active && !isExpired(atual.expiresAt, agora);
  if (valendo && atual.source !== "APPLE") return null;
  if (valendo && atual.expiresAt && atual.expiresAt >= expiraEm) return null;
  return { expiresAt: expiraEm };
}

/** Reembolso/revogação pela Apple só corta o que a Apple deu: compra do Hubla ou VIP da Dani
 * no mesmo e-mail continuam valendo. */
export function revogacaoAppleCorta(atual: LiberacaoAtual): boolean {
  return atual !== null && atual.source === "APPLE" && atual.active && atual.lastHublaInvoiceId === null;
}

const CAMPOS_DA_LIBERACAO = { source: true, active: true, expiresAt: true, lastHublaInvoiceId: true } as const;

async function liberar(email: string, expiraEm: Date) {
  const normalizado = normalizeEmail(email);
  const atual = await prisma.allowedEmail.findUnique({ where: { email: normalizado }, select: CAMPOS_DA_LIBERACAO });
  const decisao = decidirLiberacaoApple(atual, expiraEm);
  if (!decisao) return;
  await prisma.allowedEmail.upsert({
    where: { email: normalizado },
    // A fatura do Hubla vencida sai junto: a linha agora é da Apple, e o reembolso da Apple tem
    // que conseguir cortar (ver revogacaoAppleCorta).
    update: { source: "APPLE", active: true, expiresAt: decisao.expiresAt, lastHublaInvoiceId: null },
    create: { email: normalizado, source: "APPLE", active: true, expiresAt: decisao.expiresAt, note: "Apple: assinatura no app iOS" },
  });
}

async function revogar(email: string) {
  const normalizado = normalizeEmail(email);
  const atual = await prisma.allowedEmail.findUnique({ where: { email: normalizado }, select: CAMPOS_DA_LIBERACAO });
  if (revogacaoAppleCorta(atual)) await prisma.allowedEmail.update({ where: { email: normalizado }, data: { active: false } });
}

/** Grava na conta o token das compras dela, pra o aviso da Apple achar a conta (ver
 * User.tokenApple). Chamado quando a tela de assinatura aparece, antes de qualquer compra. */
export async function guardarTokenApple(conta: { id: string; email: string }): Promise<string> {
  const token = tokenDaConta(conta.email);
  await prisma.user.updateMany({ where: { id: conta.id, tokenApple: null }, data: { tokenApple: token } });
  return token;
}

/**
 * A linha do pagamento para o Farol (06/10/2026). Pura, para o teste conferir a conta do preço.
 * A Apple manda o preço em milésimos da moeda (R$ 87,90 = 87900); aqui vira centavos.
 */
export function linhaDoPagamento(tx: JWSTransactionDecodedPayload, tipoDoAviso?: string) {
  if (!tx.transactionId || !tx.originalTransactionId || !tx.productId) return null;
  const renovacao = tipoDoAviso === "DID_RENEW" || tx.transactionId !== tx.originalTransactionId;
  return {
    transactionId: tx.transactionId,
    originalTransactionId: tx.originalTransactionId,
    productId: tx.productId,
    precoCentavos: typeof tx.price === "number" ? Math.round(tx.price / 10) : null,
    moeda: tx.currency ?? null,
    compradaEm: new Date(tx.purchaseDate ?? Date.now()),
    tipo: renovacao ? "renovacao" : "compra",
    ambiente: String(tx.environment ?? "Production"),
  };
}

/** Guarda o pagamento. Nunca derruba a compra: o acesso da pessoa vale mais que a contagem. */
async function guardarPagamento(tx: JWSTransactionDecodedPayload, tipoDoAviso?: string, reembolsadaEm?: Date) {
  const linha = linhaDoPagamento(tx, tipoDoAviso);
  if (!linha) return;
  try {
    await prisma.transacaoApple.upsert({
      where: { transactionId: linha.transactionId },
      update: {
        ...(linha.precoCentavos !== null ? { precoCentavos: linha.precoCentavos, moeda: linha.moeda, precoDeTabela: false } : {}),
        ...(reembolsadaEm ? { reembolsadaEm } : {}),
      },
      create: { ...linha, reembolsadaEm: reembolsadaEm ?? null },
    });
  } catch (e) {
    console.error("Apple: não consegui guardar o pagamento", e);
  }
}

export type ResultadoDaCompra = { ok: true; expiresAt: Date } | { ok: false; motivo: "outra-conta" | "sem-validade" };

/**
 * Registra a compra (ou a restauração) que o app mandou depois do StoreKit. A transação já vem
 * com a assinatura conferida (ver verificarTransacao).
 */
export async function registrarCompraApple(
  conta: { id: string; email: string },
  tx: JWSTransactionDecodedPayload,
  agora: Date = new Date(),
): Promise<ResultadoDaCompra> {
  if (!tx.originalTransactionId || tx.appAccountToken?.toLowerCase() !== tokenDaConta(conta.email)) return { ok: false, motivo: "outra-conta" };
  const ja = await prisma.assinaturaApple.findUnique({
    where: { originalTransactionId: tx.originalTransactionId },
    select: { userId: true, revogadaEm: true },
  });
  // Mesma compra presa a uma conta excluída e recriada com o mesmo e-mail: o token (do e-mail)
  // bate, então ela volta pra conta nova. Conta diferente de verdade não passa no token acima.
  if (!transacaoValendo(tx, agora) || anteriorAoReembolso(tx, ja?.revogadaEm ?? null)) return { ok: false, motivo: "sem-validade" };

  const expiresAt = new Date(tx.expiresDate!);
  await prisma.assinaturaApple.upsert({
    where: { originalTransactionId: tx.originalTransactionId },
    update: { userId: conta.id, productId: tx.productId!, expiresAt, revogadaEm: null },
    create: {
      originalTransactionId: tx.originalTransactionId,
      userId: conta.id,
      productId: tx.productId!,
      expiresAt,
      ambiente: String(tx.environment ?? "Production"),
    },
  });
  await liberar(conta.email, expiresAt);
  await guardarPagamento(tx);
  return { ok: true, expiresAt };
}

/** Os avisos que a Apple manda sozinha (App Store Server Notifications V2). */
const RENOVOU = new Set(["SUBSCRIBED", "DID_RENEW", "RENEWAL_EXTENDED", "OFFER_REDEEMED", "REFUND_REVERSED"]);
const REVOGOU = new Set(["REFUND", "REVOKE"]);

export async function aplicarAvisoApple(tipo: string, tx: JWSTransactionDecodedPayload): Promise<"renovou" | "revogou" | "ignorado"> {
  if (!tx.originalTransactionId) return "ignorado";
  const id = tx.originalTransactionId;
  let assinatura = await prisma.assinaturaApple.findUnique({
    where: { originalTransactionId: id },
    select: { revogadaEm: true, user: { select: { id: true, email: true } } },
  });

  // Compra que o app ainda não registrou: compra aprovada depois ("Pedir para comprar"), app
  // fechado no meio, ou reembolso que chegou antes. A conta é achada pelo token da compra.
  if (!assinatura) {
    if (!tx.appAccountToken || !tx.productId || !IDS_DOS_PRODUTOS.includes(tx.productId)) return "ignorado";
    const user = await prisma.user.findUnique({ where: { tokenApple: tx.appAccountToken.toLowerCase() }, select: { id: true, email: true } });
    if (!user) return "ignorado";
    await prisma.assinaturaApple.create({
      data: {
        originalTransactionId: id,
        userId: user.id,
        productId: tx.productId,
        expiresAt: new Date(tx.expiresDate ?? Date.now()),
        ambiente: String(tx.environment ?? "Production"),
        revogadaEm: REVOGOU.has(tipo) ? new Date() : null,
      },
    });
    assinatura = { revogadaEm: REVOGOU.has(tipo) ? new Date() : null, user };
  }

  if (REVOGOU.has(tipo)) {
    await prisma.assinaturaApple.update({ where: { originalTransactionId: id }, data: { revogadaEm: new Date() } });
    await revogar(assinatura.user.email);
    await guardarPagamento(tx, tipo, new Date());
    return "revogou";
  }
  // Aviso de renovação velho chegando depois do reembolso não reabre nada.
  if (RENOVOU.has(tipo) && transacaoValendo(tx) && !anteriorAoReembolso(tx, assinatura.revogadaEm)) {
    const expiresAt = new Date(tx.expiresDate!);
    await prisma.assinaturaApple.update({
      where: { originalTransactionId: id },
      data: { expiresAt, productId: tx.productId!, revogadaEm: null },
    });
    await liberar(assinatura.user.email, expiresAt);
    await guardarPagamento(tx, tipo);
    return "renovou";
  }
  return "ignorado";
}

// Mudou para o repo da liberação (06/10/2026), junto da regra que as três portas usam.
export { acessoVeioDaApple } from "./allowedEmail.repo";
