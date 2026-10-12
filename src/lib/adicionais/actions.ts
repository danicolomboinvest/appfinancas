"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { verificarTransacao } from "@/lib/apple/verificar";
import { registrarCompraApple } from "@/lib/repositories/assinaturaApple.repo";
import type { Adicional } from "./config";

export type RespostaDoAdicional = { ok: true } | { ok: false; mensagem: string };

/**
 * Chamado pela tela do adicional no app iOS depois do StoreKit (compra ou "Restaurar compra"),
 * com as transações assinadas pela Apple. Responde "ok" só se uma delas for ESTE adicional, desta
 * conta e valendo. As outras (a assinatura do app, o outro adicional) ficam registradas também.
 */
export async function registrarAdicionalAppleAction(adicional: Adicional, transacoes: string[]): Promise<RespostaDoAdicional> {
  const session = await auth();
  if (!session?.user) return { ok: false, mensagem: "Entre na sua conta de novo e tente outra vez." };
  const conta = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } });
  if (!conta) return { ok: false, mensagem: "Entre na sua conta de novo e tente outra vez." };

  let achou = false;
  let outraConta = false;
  for (const jws of transacoes.slice(0, 20)) {
    if (typeof jws !== "string" || jws.length > 20_000) continue;
    const tx = await verificarTransacao(jws).catch(() => null);
    if (!tx) continue;
    const r = await registrarCompraApple(conta, tx);
    if (r.ok && r.adicional === adicional) achou = true;
    if (!r.ok && r.motivo === "outra-conta") outraConta = true;
  }
  if (achou) {
    revalidatePath("/", "layout");
    return { ok: true };
  }
  return {
    ok: false,
    mensagem: outraConta
      ? "Essa compra está ligada a outra conta do SPI Finance. Entre com a conta em que você comprou."
      : "Não achamos essa compra neste ID Apple.",
  };
}
