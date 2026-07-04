import { Decimal } from "@/lib/finance/decimal";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import { nper } from "@/lib/finance/nper";

export type EmergencyFundInput = {
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  annualRate: number;
};

export type EmergencyFundResult = {
  monthlyRate: number;
  /** null quando a meta é inatingível com os parâmetros atuais (sem aporte e sem saldo/rendimento). */
  monthsToTarget: number | null;
  projection: { month: number; balance: number }[];
};

const MAX_PROJECTED_MONTHS = 600;

/**
 * Meses até atingir a reserva (NPER) e projeção mês a mês: cada mês rende sobre o
 * acumulado e depois soma o novo aporte — mesma lógica da planilha original.
 */
export function computeEmergencyFundPlan(input: EmergencyFundInput): EmergencyFundResult {
  const monthlyRate = annualToMonthly(input.annualRate);
  const gap = new Decimal(input.targetAmount).minus(input.currentAmount);

  let monthsToTarget: number | null = null;
  if (gap.lte(0)) {
    monthsToTarget = 0;
  } else if (input.monthlyContribution > 0 || (input.currentAmount > 0 && monthlyRate.greaterThan(0))) {
    const raw = nper(monthlyRate, input.monthlyContribution, input.currentAmount, input.targetAmount).toNumber();
    monthsToTarget = Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : null;
  }

  const projection: { month: number; balance: number }[] = [];
  let balance = new Decimal(input.currentAmount);
  const monthsToProject = Math.min(monthsToTarget ?? MAX_PROJECTED_MONTHS, MAX_PROJECTED_MONTHS);

  for (let month = 1; month <= monthsToProject; month += 1) {
    balance = balance.times(monthlyRate.plus(1)).plus(input.monthlyContribution);
    projection.push({ month, balance: balance.toNumber() });
    if (input.targetAmount > 0 && balance.greaterThanOrEqualTo(input.targetAmount)) break;
  }

  return { monthlyRate: monthlyRate.toNumber(), monthsToTarget, projection };
}
