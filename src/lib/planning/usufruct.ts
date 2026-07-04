import { Decimal } from "@/lib/finance/decimal";

export type UsufructInput = {
  /** Patrimônio ao se aposentar, em termos reais (poder de compra de hoje). */
  finalValueReal: number;
  usufructAnnualRate: number;
  otherPassiveIncome: number;
  desiredPassiveIncome: number;
};

export type UsufructResult = {
  monthlyPassiveIncomeFromPortfolio: number;
  totalPassiveIncome: number;
  /** Positivo = a renda passiva cobre o padrão de vida desejado. Negativo = falta patrimônio. */
  surplusOrDeficit: number;
};

/**
 * Fase de usufruto: em vez da regra dos 4% abstrata, compara a renda que o patrimônio
 * realmente geraria (rendimento anual real / 12) contra o gasto mensal desejado.
 */
export function computeUsufruct(input: UsufructInput): UsufructResult {
  const annualYield = new Decimal(input.finalValueReal).times(input.usufructAnnualRate);
  const monthlyPassiveIncomeFromPortfolio = annualYield.div(12);
  const totalPassiveIncome = monthlyPassiveIncomeFromPortfolio.plus(input.otherPassiveIncome);
  const surplusOrDeficit = totalPassiveIncome.minus(input.desiredPassiveIncome);

  return {
    monthlyPassiveIncomeFromPortfolio: monthlyPassiveIncomeFromPortfolio.toNumber(),
    totalPassiveIncome: totalPassiveIncome.toNumber(),
    surplusOrDeficit: surplusOrDeficit.toNumber(),
  };
}
