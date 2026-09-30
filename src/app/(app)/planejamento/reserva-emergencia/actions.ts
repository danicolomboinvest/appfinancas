"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { alinharReservaComCarteira, upsertEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { travarNaTransacao, type TipoDecisao } from "@/lib/repositories/decisao.repo";
import { emergencyFundSchema } from "@/lib/validations/emergency-fund.schema";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { chaveDoMesDaReserva, valorDoGuardei } from "@/lib/planning/reserva-guardei";

export type EmergencyFundState = { error?: string };

export async function saveEmergencyFundAction(
  _prevState: EmergencyFundState,
  formData: FormData,
): Promise<EmergencyFundState> {
  const parsed = emergencyFundSchema.safeParse({
    targetMonths: formData.get("targetMonths"),
    monthlyExpenseBase: formData.get("monthlyExpenseBase"),
    currentAmount: formData.get("currentAmount"),
    monthlyContribution: formData.get("monthlyContribution"),
    annualRate: formData.get("annualRate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await upsertEmergencyFund(ctx, parsed.data);
  revalidatePath("/planejamento/reserva-emergencia");
  return {};
}

/** O aviso de "valores diferentes" (tela da reserva × Carteira): fica valendo o da Carteira. */
export async function usarReservaDaCarteiraAction(): Promise<void> {
  const ctx = await getRequiredSession();
  await alinharReservaComCarteira(ctx);
  revalidatePath("/planejamento/reserva-emergencia");
  revalidatePath("/carteira", "layout");
  revalidatePath("/mensal/foco");
  revalidatePath("/dashboard");
}

export type GuardeiNaReservaState = { ok?: boolean; error?: string; valor?: number; jaFeito?: boolean };

const TIPO_GUARDEI: TipoDecisao = "reserva_guardei";
const guardeiSchema = z.object({ valor: z.number().positive().max(100_000_000).optional() });

/**
 * "Guardei este mês" na reserva: lança o guardado no mês atual (como dinheiro guardado, não
 * gasto) e soma o mesmo valor no "quanto já tenho". Usa os caminhos que o fechamento do mês
 * já usa pra mandar a sobra pra reserva — lançamento de aporte + incremento na reserva, na
 * mesma transação.
 *
 * O valor combinado é lido do banco aqui, nunca o da tela. O mês fica marcado numa Decisao
 * ("reserva_guardei", chave "2026-09"), dentro de uma transação travada pela mesma chave:
 * duas abas, ou dois toques rápidos, não somam o mesmo mês duas vezes. Sem mudar o banco:
 * `tipo` da Decisao é texto livre.
 *
 * `valor` só vem no "outro valor" (ela guardou diferente do combinado).
 */
export async function guardeiNaReservaAction(input: { valor?: number } = {}): Promise<GuardeiNaReservaState> {
  const parsed = guardeiSchema.safeParse(input);
  if (!parsed.success) return { error: "Valor inválido. Confira e tente de novo." };
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const chave = chaveDoMesDaReserva(agora);
  const empresa = ehEmpresa(ctx.profileKind);

  const resultado = await prisma.$transaction(async (tx): Promise<GuardeiNaReservaState> => {
    await travarNaTransacao(tx, `${ctx.userId}|${ctx.profileId ?? ""}|${TIPO_GUARDEI}|${chave}`);
    const jaFeito = await tx.decisao.count({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: TIPO_GUARDEI, chave } });
    if (jaFeito > 0) return { ok: true, jaFeito: true };
    const fundo = await tx.emergencyFund.findFirst({
      where: { userId: ctx.userId, profileId: ctx.profileId },
      select: { id: true, targetAmount: true, currentAmount: true, monthlyContribution: true },
    });
    if (!fundo) return { error: "Monte a reserva primeiro, no formulário abaixo." };
    const valor = valorDoGuardei(
      { targetAmount: Number(fundo.targetAmount), currentAmount: Number(fundo.currentAmount), monthlyContribution: Number(fundo.monthlyContribution) },
      parsed.data.valor ?? null,
    );
    if (valor === null) return { error: "Diga quanto você guardou." };
    await tx.monthlyEntry.create({
      data: {
        userId: ctx.userId, profileId: ctx.profileId,
        year: ano,
        month: mes,
        category: "INVESTMENT_CONTRIBUTION",
        description: empresa ? "Pro caixa de segurança" : "Guardei na reserva",
        amount: valor,
        entryDate: new Date(Date.UTC(ano, mes - 1, agora.getDate())),
      },
    });
    await tx.emergencyFund.updateMany({
      where: { id: fundo.id, userId: ctx.userId, profileId: ctx.profileId },
      data: { currentAmount: { increment: valor } },
    });
    await tx.decisao.create({
      data: { userId: ctx.userId, profileId: ctx.profileId, tipo: TIPO_GUARDEI, chave, valor },
    });
    return { ok: true, valor };
  });

  if (resultado.ok && !resultado.jaFeito) {
    revalidatePath("/planejamento/reserva-emergencia");
    revalidatePath("/mensal", "layout");
    revalidatePath("/carteira", "layout");
    revalidatePath("/dashboard");
  }
  return resultado;
}
