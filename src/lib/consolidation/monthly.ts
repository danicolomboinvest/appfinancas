import { Decimal } from "@/lib/finance/decimal";
import type { AuthContext } from "@/lib/auth/session";
import { somarPorMesETipo, type SomaPorTipo } from "./escopo";

export type MonthlySummary = {
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  /** income - expense - investment: fecha o caixa do mês (ideal ~0 ou positivo). */
  balance: number;
};

/**
 * Soma por tipo, em Decimal (centavos exatos), das linhas da carga única. Sem filtro de mês aqui:
 * quem chama já pediu ao banco só o período que quer.
 */
export function resumoDasSomas(somas: Pick<SomaPorTipo, "category" | "total">[]): MonthlySummary {
  const totals = {
    INCOME: new Decimal(0),
    EXPENSE: new Decimal(0),
    INVESTMENT_CONTRIBUTION: new Decimal(0),
  };

  for (const s of somas) {
    totals[s.category] = totals[s.category].plus(new Decimal(s.total));
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
 * Consolidação de um único mês via aggregation query direta (GROUP BY), substituindo o
 * padrão de planilha "Database -> Pivôs -> Consolidado" por uma soma no próprio banco.
 * Casal simples: o mês dos dois (o escondido do outro não soma), pela carga única (escopo.ts).
 */
export async function getMonthlySummary(ctx: AuthContext, year: number, month: number): Promise<MonthlySummary> {
  return resumoDasSomas(await somarPorMesETipo(ctx, { year, month }));
}

/**
 * Consolidação do ano inteiro (mesma lógica de getMonthlySummary, sem filtro de mês), alimenta
 * a "visão anual" do Fluxo, com os totais acumulados das três categorias e o saldo do ano. Mesmo
 * escopo do mês: antes lia só quem estava logada e o ano do casal não fechava com os meses.
 */
export async function getAnnualSummary(ctx: AuthContext, year: number): Promise<MonthlySummary> {
  return resumoDasSomas(await somarPorMesETipo(ctx, { year }));
}
