"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyContributionAllocations, applyWithdrawalAllocations, resgatarDeUmAtivo, type AllocationInput, type AllocationResult } from "@/lib/portfolio/contribution-link";
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

/** "Esse resgate saiu desses investimentos": o espelho do allocateContributionAction, mesmo mês. */
export async function allocateWithdrawalAction(allocations: AllocationInput[], doMesPassado = false): Promise<AllocationResult> {
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const hoje = doMesPassado === true ? new Date(agora.getFullYear(), agora.getMonth() - 1, 1) : agora;
  const res = await applyWithdrawalAllocations(ctx, hoje.getFullYear(), hoje.getMonth() + 1, allocations);
  if (res.ok) {
    revalidatePath("/carteira");
    revalidatePath("/carteira/por-objetivo");
    revalidatePath("/planejamento/metas");
    revalidatePath("/dashboard");
    revalidatePath(`/mensal/${hoje.getFullYear()}/${hoje.getMonth() + 1}`);
  }
  return res;
}

/** "Resgatei" no próprio investimento: registra no mês e desconta do ativo (ver resgatarDeUmAtivo). */
export async function resgatarDoAtivoAction(input: { assetId: string; amount: number; date: string }): Promise<{ ok: true; meta: string | null } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
  if (!m) return { ok: false, error: "Escolha a data do resgate." };
  // Meio-dia: a data não "volta um dia" na conversão para UTC.
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (date.getTime() > Date.now() + 36 * 3600 * 1000) return { ok: false, error: "A data do resgate não pode ser no futuro." };
  const res = await resgatarDeUmAtivo(ctx, { assetId: String(input.assetId).slice(0, 60), amount: Number(input.amount), date });
  if (res.ok) {
    revalidatePath("/carteira");
    revalidatePath("/carteira/por-objetivo");
    revalidatePath("/planejamento/metas");
    revalidatePath("/dashboard");
    revalidatePath("/mensal/foco");
    revalidatePath(`/mensal/${date.getFullYear()}/${date.getMonth() + 1}`);
  }
  return res;
}
