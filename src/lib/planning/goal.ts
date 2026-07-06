import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import { fv } from "@/lib/finance/fv";
import { pmt } from "@/lib/finance/pmt";

export type GoalCalcInput = {
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  annualRate: number;
  now?: Date;
};

export type GoalStatus = "NOT_STARTED" | "ON_TRACK" | "BEHIND" | "ACHIEVED";

export type GoalCalcResult = {
  monthsRemaining: number;
  monthlyRate: number;
  /** Quanto o valor já guardado vai virar até a data-alvo, sem novos aportes. */
  futureValueOfSaved: number;
  /** Quanto ainda falta construir além do que o valor guardado já vai gerar sozinho. */
  amountMissing: number;
  requiredMonthlyContribution: number;
  status: GoalStatus;
};

const AVG_DAYS_PER_MONTH = 30.4375;

/**
 * Para cada meta: quanto falta, quanto seria necessário aportar por mês para chegar lá
 * na data-alvo, e o status (concluída, no prazo, atrasada, ou sem prazo hábil).
 */
export function computeGoalPlan(input: GoalCalcInput): GoalCalcResult {
  const now = input.now ?? new Date();
  const monthsRemaining = Math.max(
    Math.round((input.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * AVG_DAYS_PER_MONTH)),
    0,
  );
  const monthlyRate = annualToMonthly(input.annualRate);
  const achieved = input.currentAmount >= input.targetAmount;
  const overdue = !achieved && input.targetDate.getTime() < now.getTime();

  if (achieved) {
    return {
      monthsRemaining,
      monthlyRate: monthlyRate.toNumber(),
      futureValueOfSaved: input.currentAmount,
      amountMissing: 0,
      requiredMonthlyContribution: 0,
      status: "ACHIEVED",
    };
  }

  if (overdue || monthsRemaining === 0) {
    const amountMissing = new Decimal(input.targetAmount).minus(input.currentAmount).toNumber();
    return {
      monthsRemaining,
      monthlyRate: monthlyRate.toNumber(),
      futureValueOfSaved: input.currentAmount,
      amountMissing,
      requiredMonthlyContribution: amountMissing,
      status: overdue ? "BEHIND" : "NOT_STARTED",
    };
  }

  const futureValueOfSaved = fv(monthlyRate, monthsRemaining, 0, input.currentAmount);
  const amountMissing = new Decimal(input.targetAmount).minus(futureValueOfSaved);
  const requiredMonthlyContribution = pmt(monthlyRate, monthsRemaining, input.currentAmount, input.targetAmount, 1);

  return {
    monthsRemaining,
    monthlyRate: monthlyRate.toNumber(),
    futureValueOfSaved: futureValueOfSaved.toNumber(),
    amountMissing: amountMissing.toNumber(),
    requiredMonthlyContribution: requiredMonthlyContribution.toNumber(),
    status: "ON_TRACK",
  };
}

export type GoalTrajectoryPoint = { month: number; amount: number };

/**
 * Trajetória PROJETADA (não histórica) do valor guardado até a data-alvo, assumindo o
 * aporte mensal sugerido por `computeGoalPlan` a partir de hoje. Não existe, hoje, nenhum
 * histórico real de aportes por meta no banco — por isso esta função mostra "para onde a
 * meta está indo" sob o plano atual, não "de onde ela veio". Reaproveita monthlyRate e
 * requiredMonthlyContribution já calculados por computeGoalPlan, sem introduzir uma nova
 * fórmula financeira.
 */
export function computeGoalTrajectory(input: GoalCalcInput, plan: GoalCalcResult): GoalTrajectoryPoint[] {
  const points: GoalTrajectoryPoint[] = [{ month: 0, amount: input.currentAmount }];
  if (plan.status === "ACHIEVED" || plan.monthsRemaining <= 0) return points;

  const monthlyRate = new Decimal(plan.monthlyRate);
  const contribution = new Decimal(plan.requiredMonthlyContribution);
  let balance = new Decimal(input.currentAmount);

  for (let month = 1; month <= plan.monthsRemaining; month++) {
    balance = balance.plus(contribution).times(monthlyRate.plus(1));
    points.push({ month, amount: balance.toNumber() });
  }
  return points;
}
