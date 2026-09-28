"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyContributionAllocations, type AllocationInput, type AllocationResult } from "@/lib/portfolio/contribution-link";
import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * "Esse aporte entrou nesses ativos": aplica a distribuição do aporte do MÊS CORRENTE, ou do
 * mês passado (a sobra que o fechamento mandou pra reserva é lançada no mês de onde sobrou).
 *
 * O mês vem do servidor, não do formulário: só "este mês" ou "o mês passado", e assim ninguém
 * consegue mandar um mês qualquer pela requisição.
 */
export async function allocateContributionAction(allocations: AllocationInput[], doMesPassado = false): Promise<AllocationResult> {
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const hoje = doMesPassado === true ? new Date(agora.getFullYear(), agora.getMonth() - 1, 1) : agora;
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
