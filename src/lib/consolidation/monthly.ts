import { Decimal } from "@/lib/finance/decimal";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type MonthlySummary = {
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  /** income - expense - investment: fecha o caixa do mês (ideal ~0 ou positivo). */
  balance: number;
};

/**
 * Consolidação de um único mês via aggregation query direta (GROUP BY), substituindo o
 * padrão de planilha "Database -> Pivôs -> Consolidado" por uma soma no próprio banco.
 */
export async function getMonthlySummary(ctx: AuthContext, year: number, month: number): Promise<MonthlySummary> {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["category"],
    where: { userId: ctx.userId, year, month },
    _sum: { amount: true },
  });

  const totals = {
    INCOME: new Decimal(0),
    EXPENSE: new Decimal(0),
    INVESTMENT_CONTRIBUTION: new Decimal(0),
  };

  for (const group of grouped) {
    totals[group.category] = new Decimal(group._sum.amount ?? 0);
  }

  const balance = totals.INCOME.minus(totals.EXPENSE).minus(totals.INVESTMENT_CONTRIBUTION);

  return {
    totalIncome: totals.INCOME.toNumber(),
    totalExpense: totals.EXPENSE.toNumber(),
    totalInvestment: totals.INVESTMENT_CONTRIBUTION.toNumber(),
    balance: balance.toNumber(),
  };
}

/**
 * Consolidação do ano inteiro (mesma lógica de getMonthlySummary, sem filtro de mês) — alimenta
 * a "visão anual" do Fluxo, com os totais acumulados das três categorias e o saldo do ano.
 */
export async function getAnnualSummary(ctx: AuthContext, year: number): Promise<MonthlySummary> {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["category"],
    where: { userId: ctx.userId, year },
    _sum: { amount: true },
  });

  const totals = {
    INCOME: new Decimal(0),
    EXPENSE: new Decimal(0),
    INVESTMENT_CONTRIBUTION: new Decimal(0),
  };

  for (const group of grouped) {
    totals[group.category] = new Decimal(group._sum.amount ?? 0);
  }

  const balance = totals.INCOME.minus(totals.EXPENSE).minus(totals.INVESTMENT_CONTRIBUTION);

  return {
    totalIncome: totals.INCOME.toNumber(),
    totalExpense: totals.EXPENSE.toNumber(),
    totalInvestment: totals.INVESTMENT_CONTRIBUTION.toNumber(),
    balance: balance.toNumber(),
  };
}
