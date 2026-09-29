"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { deleteOwnTransactionRule } from "@/lib/repositories/transaction-rule.repo";

/**
 * Apaga uma regra aprendida. Antes não havia tela pra isso: uma regra ruim (uma loja ensinada
 * na categoria errada) ficava valendo pra sempre em toda importação e no Open Finance.
 */
export async function deleteTransactionRuleAction(ruleId: string) {
  const id = z.string().min(1).max(60).parse(ruleId);
  const ctx = await getRequiredSession();
  await deleteOwnTransactionRule(ctx, id);
  revalidatePath("/configuracoes/categorias");
}
