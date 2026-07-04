import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type MonthlyBreakdown = {
  month: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  balance: number;
};

export type YearlySummary = {
  months: MonthlyBreakdown[];
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  balance: number;
  /** (renda - gastos) / renda, no ano — métrica de destaque no dashboard. */
  savingsRate: number | null;
};

/**
 * Consolidação do ano inteiro via aggregation query direta (GROUP BY mês + categoria),
 * substituindo o padrão de planilha "Consolidado do Ano" (12 abas lado a lado).
 */
export async function getYearlySummary(ctx: AuthContext, year: number): Promise<YearlySummary> {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["month", "category"],
    where: { userId: ctx.userId, year },
    _sum: { amount: true },
  });

  const byMonth = new Map<number, { income: Decimal; expense: Decimal; investment: Decimal }>();
  for (let month = 1; month <= 12; month += 1) {
    byMonth.set(month, { income: new Decimal(0), expense: new Decimal(0), investment: new Decimal(0) });
  }

  for (const group of grouped) {
    const entry = byMonth.get(group.month);
    if (!entry) continue;
    const sum = new Decimal(group._sum.amount ?? 0);
    if (group.category === "INCOME") entry.income = sum;
    else if (group.category === "EXPENSE") entry.expense = sum;
    else entry.investment = sum;
  }

  const months: MonthlyBreakdown[] = Array.from(byMonth.entries()).map(([month, v]) => ({
    month,
    totalIncome: v.income.toNumber(),
    totalExpense: v.expense.toNumber(),
    totalInvestment: v.investment.toNumber(),
    balance: v.income.minus(v.expense).minus(v.investment).toNumber(),
  }));

  const totalIncome = months.reduce((sum, m) => sum + m.totalIncome, 0);
  const totalExpense = months.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalInvestment = months.reduce((sum, m) => sum + m.totalInvestment, 0);
  const balance = totalIncome - totalExpense - totalInvestment;

  return {
    months,
    totalIncome,
    totalExpense,
    totalInvestment,
    balance,
    savingsRate: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : null,
  };
}
