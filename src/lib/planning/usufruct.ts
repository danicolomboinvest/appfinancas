import { Decimal } from "@/lib/finance/decimal";

export type UsufructInput = {
  /** Patrimônio ao se aposentar, em termos reais (poder de compra de hoje). */
  finalValueReal: number;
  /**
   * Rendimento anual ACIMA da inflação (real), porque o patrimônio e o gasto desejado estão em
   * dinheiro de hoje. A tela pede "acima da inflação" com todas as letras: o campo de acúmulo,
   * ao lado, é nominal, e ler este como nominal inflava a renda passiva em até 4x.
   */
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
/**
 * Na aposentadoria o rendimento deveria ser mais conservador que o da fase de acumular. Como
 * o de acumular é digitado antes da inflação, a comparação é contra a taxa real dele.
 */
export function usufructRateAboveAccumulation(usufructAnnualRate: number, accumulationRealAnnualRate: number): boolean {
  return usufructAnnualRate > accumulationRealAnnualRate + 1e-9;
}

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
