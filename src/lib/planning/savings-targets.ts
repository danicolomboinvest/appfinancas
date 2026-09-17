import type { AuthContext } from "@/lib/auth/session";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { computeGoalPlan } from "./goal";
import type { SavingsTarget } from "./savings-split";

/**
 * A fila de "pra onde vai o que você guarda": a reserva (o que falta pra fechar, contando o
 * que está na carteira marcado como reserva) e as metas abertas, por prazo.
 */
export async function getSavingsTargets(ctx: AuthContext, today: Date = new Date()): Promise<SavingsTarget[]> {
  const [fund, goals, assets] = await Promise.all([getEmergencyFund(ctx), listGoalsWithProgress(ctx), listAssets(ctx)]);
  const targets: SavingsTarget[] = [];

  if (fund) {
    const inAssets = assets.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((s, a) => s + Number(a.currentValue), 0);
    const current = Math.max(Number(fund.currentAmount), inAssets);
    const target = fund.targetMonths * Number(fund.monthlyExpenseBase);
    targets.push({
      id: "reserva",
      name: "Reserva de emergência",
      kind: "reserva",
      remaining: Math.max(0, target - current),
      monthlyNeeded: Number(fund.monthlyContribution),
    });
  }

  for (const g of goals) {
    const targetAmount = Number(g.targetAmount);
    const plan = computeGoalPlan({
      targetAmount,
      currentAmount: g.computedCurrentAmount,
      targetDate: g.targetDate ?? today,
      annualRate: Number(g.annualRate ?? 0),
      startedAt: g.createdAt,
    });
    if (plan.status === "ACHIEVED") continue;
    targets.push({
      id: g.id,
      name: g.name,
      kind: "meta",
      remaining: Math.max(0, targetAmount - g.computedCurrentAmount),
      monthlyNeeded: plan.requiredMonthlyContribution,
    });
  }
  return targets;
}
