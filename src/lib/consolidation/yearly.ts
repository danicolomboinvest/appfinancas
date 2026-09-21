import type { EntryCategory } from "@prisma/client";
import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { monthsElapsedInYear } from "./realized-months";

export type MonthlyBreakdown = {
  month: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  balance: number;
  /** false para meses futuros que só têm lançamentos por causa de despesas recorrentes
   *  lançadas antecipadamente (ver `createRecurringMonthlyEntries`), ainda não aconteceram. */
  isRealized: boolean;
};

export type YearlySummary = {
  months: MonthlyBreakdown[];
  /** Soma apenas dos meses já ocorridos (`isRealized`), "quanto já aconteceu de fato". */
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  balance: number;
  savingsRate: number | null;
  /** Soma dos 12 meses do ano, incluindo meses futuros projetados por recorrência, use para
   *  "como o ano deve fechar se nada mudar", nunca como "quanto já aconteceu". */
  projectedTotalIncome: number;
  projectedTotalExpense: number;
  projectedTotalInvestment: number;
  projectedBalance: number;
};

type GroupedAmount = { month: number; category: EntryCategory; sum: number };

/**
 * Agregação pura (sem Prisma): monta os 12 meses do ano a partir de somas já agrupadas por
 * (mês, categoria) e marca quais já ocorreram, meses com `month > monthsElapsed` só existem
 * por causa de recorrência lançada antecipadamente e não devem ser tratados como realizados.
 */
export function buildMonthlyBreakdowns(grouped: GroupedAmount[], monthsElapsed: number): MonthlyBreakdown[] {
  const byMonth = new Map<number, { income: Decimal; expense: Decimal; investment: Decimal }>();
  for (let month = 1; month <= 12; month += 1) {
    byMonth.set(month, { income: new Decimal(0), expense: new Decimal(0), investment: new Decimal(0) });
  }

  for (const group of grouped) {
    const entry = byMonth.get(group.month);
    if (!entry) continue;
    const sum = new Decimal(group.sum);
    if (group.category === "INCOME") entry.income = sum;
    else if (group.category === "EXPENSE") entry.expense = sum;
    else entry.investment = sum;
  }

  return Array.from(byMonth.entries()).map(([month, v]) => ({
    month,
    totalIncome: v.income.toNumber(),
    totalExpense: v.expense.toNumber(),
    totalInvestment: v.investment.toNumber(),
    balance: v.income.minus(v.expense).minus(v.investment).toNumber(),
    isRealized: month <= monthsElapsed,
  }));
}

/**
 * Consolidação do ano inteiro via aggregation query direta (GROUP BY mês + categoria),
 * substituindo o padrão de planilha "Consolidado do Ano" (12 abas lado a lado). Os totais
 * principais (`totalIncome`/`totalExpense`/`totalInvestment`/`balance`) só somam meses já
 * ocorridos, uma despesa recorrente lançada em março não conta como "já gasta" em dezembro
 * só porque a linha do lançamento já existe no banco para os meses futuros.
 */
export async function getYearlySummary(ctx: AuthContext, year: number): Promise<YearlySummary> {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["month", "category"],
    where: { userId: ctx.userId, profileId: ctx.profileId, year },
    _sum: { amount: true },
  });

  const monthsElapsed = monthsElapsedInYear(year);
  const months = buildMonthlyBreakdowns(
    grouped.map((g) => ({ month: g.month, category: g.category, sum: Number(g._sum.amount ?? 0) })),
    monthsElapsed,
  );

  const realizedMonths = months.filter((m) => m.isRealized);
  const totalIncome = realizedMonths.reduce((sum, m) => sum + m.totalIncome, 0);
  const totalExpense = realizedMonths.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalInvestment = realizedMonths.reduce((sum, m) => sum + m.totalInvestment, 0);
  const balance = totalIncome - totalExpense - totalInvestment;

  const projectedTotalIncome = months.reduce((sum, m) => sum + m.totalIncome, 0);
  const projectedTotalExpense = months.reduce((sum, m) => sum + m.totalExpense, 0);
  const projectedTotalInvestment = months.reduce((sum, m) => sum + m.totalInvestment, 0);
  const projectedBalance = projectedTotalIncome - projectedTotalExpense - projectedTotalInvestment;

  return {
    months,
    totalIncome,
    totalExpense,
    totalInvestment,
    balance,
    savingsRate: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : null,
    projectedTotalIncome,
    projectedTotalExpense,
    projectedTotalInvestment,
    projectedBalance,
  };
}
