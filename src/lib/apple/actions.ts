"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { verificarTransacao } from "./verificar";
import { registrarCompraApple } from "@/lib/repositories/assinaturaApple.repo";

export type RespostaDaCompra = { ok: true } | { ok: false; mensagem: string };

/**
 * Chamado pelo app iOS logo depois do StoreKit (compra ou "Restaurar compras") com as transações
 * assinadas pela Apple. Libera se ALGUMA delas for desta conta e estiver valendo.
 */
export async function registrarCompraAppleAction(transacoes: string[]): Promise<RespostaDaCompra> {
  const session = await auth();
  if (!session?.user) return { ok: false, mensagem: "Entre na sua conta de novo e tente outra vez." };
  const conta = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } });
  if (!conta) return { ok: false, mensagem: "Entre na sua conta de novo e tente outra vez." };

  let outraConta = false;
  let registrou = false;
  for (const jws of transacoes.slice(0, 20)) {
    if (typeof jws !== "string" || jws.length > 20_000) continue;
    const tx = await verificarTransacao(jws).catch(() => null);
    if (!tx) continue;
    const r = await registrarCompraApple(conta, tx);
    // O "Restaurar compras" traz também os adicionais (11/10/2026): eles ficam registrados, mas
    // só a assinatura do app responde "ok" aqui, que é o que esta tela vende.
    if (r.ok && !r.adicional) {
      revalidatePath("/", "layout");
      return { ok: true };
    }
    if (r.ok) registrou = true;
    if (!r.ok && r.motivo === "outra-conta") outraConta = true;
  }
  if (registrou) revalidatePath("/", "layout");
  return {
    ok: false,
    mensagem: outraConta
      ? "Essa assinatura já está ligada a outra conta do SPI Finance. Entre com a conta em que você assinou."
      : "Não achamos uma assinatura ativa neste ID Apple.",
  };
}
