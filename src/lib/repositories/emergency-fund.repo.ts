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
  return prisma.emergencyFund.findUnique({ where: { userId: ctx.userId } });
}

export async function upsertEmergencyFund(ctx: AuthContext, input: EmergencyFundInput) {
  const targetAmount = input.targetMonths * input.monthlyExpenseBase;
  return prisma.emergencyFund.upsert({
    where: { userId: ctx.userId },
    update: { ...input, targetAmount },
    create: { ...input, targetAmount, userId: ctx.userId },
  });
}
