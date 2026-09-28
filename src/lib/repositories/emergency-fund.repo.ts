import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type EmergencyFundInput = {
  targetMonths: number;
  monthlyExpenseBase: number;
  currentAmount: number;
  monthlyContribution: number;
  annualRate: number;
};

export async function getEmergencyFund(ctx: AuthContext) {
  return prisma.emergencyFund.findUnique({ where: { profileId: ctx.profileId } });
}

export async function upsertEmergencyFund(ctx: AuthContext, input: EmergencyFundInput) {
  const targetAmount = input.targetMonths * input.monthlyExpenseBase;
  return prisma.emergencyFund.upsert({
    where: { profileId: ctx.profileId },
    update: { ...input, targetAmount },
    create: { ...input, targetAmount, userId: ctx.userId, profileId: ctx.profileId },
  });
}

/**
 * "Usar o valor da Carteira": o quanto a reserva tem passa a ser a soma dos investimentos
 * marcados como reserva. Recalculado aqui, nunca o número da tela. Devolve o valor gravado,
 * ou null se a pessoa ainda não montou a reserva.
 */
export async function alinharReservaComCarteira(ctx: AuthContext): Promise<number | null> {
  const ativos = await prisma.asset.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, objective: "RESERVA_EMERGENCIA" }, select: { currentValue: true } });
  const naCarteira = Math.round(ativos.reduce((s, a) => s + Number(a.currentValue), 0) * 100) / 100;
  const r = await prisma.emergencyFund.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, data: { currentAmount: naCarteira } });
  return r.count > 0 ? naCarteira : null;
}
