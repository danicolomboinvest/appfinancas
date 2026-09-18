"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyContributionAllocations, type AllocationInput, type AllocationResult } from "@/lib/portfolio/contribution-link";
import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * "Esse aporte entrou nesses ativos": aplica a distribuição do aporte do MÊS CORRENTE.
 *
 * O mês vem do servidor, não do formulário: é sempre o mês em que a pessoa está aportando, e
 * assim ninguém consegue mandar um mês qualquer pela requisição.
 */
export async function allocateContributionAction(allocations: AllocationInput[]): Promise<AllocationResult> {
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const res = await applyContributionAllocations(ctx, hoje.getFullYear(), hoje.getMonth() + 1, allocations);
  if (res.ok) {
    // Os três módulos mostram o mesmo dinheiro: todos precisam ser recarregados juntos.
    revalidatePath("/carteira");
    revalidatePath("/carteira/por-objetivo");
    revalidatePath("/planejamento/metas");
    revalidatePath("/dashboard");
    revalidatePath(`/mensal/${hoje.getFullYear()}/${hoje.getMonth() + 1}`);
  }
  return res;
}
