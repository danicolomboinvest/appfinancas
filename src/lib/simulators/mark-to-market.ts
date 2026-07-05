import { Decimal } from "@/lib/finance/decimal";
import { bondPrice } from "@/lib/finance/pv";

export type MarkToMarketInput = {
  faceValue: number;
  originalRate: number;
  newRate: number;
  totalYears: number;
  yearsRemaining: number;
};

export type SensitivityRow = {
  durationYears: number;
  cells: { rateChange: number; priceDeviation: number }[];
};

export type MarkToMarketResult = {
  carryingPrice: number;
  marketPrice: number;
  profitOrLoss: number;
  approximateSensitivity: number;
  sensitivityMatrix: SensitivityRow[];
};

const DURATION_SCENARIOS_YEARS = [1 / 365, 0.5, 1, 2, 3, 5, 7, 10, 15, 17];
const RATE_CHANGE_SCENARIOS = [-0.03, -0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02, 0.03];

/**
 * Marcação a mercado de um título prefixado: preço = valor de face trazido a valor
 * presente pela taxa. A matriz cruza diferentes durations (prazo restante até o
 * vencimento no momento da venda) com variações de taxa, usando a mesma fórmula de
 * juros compostos do preço acima (preço% = 100/(1+taxa)^duration) — nunca a
 * aproximação linear, que pode gerar preços negativos e é matematicamente inválida
 * para títulos de renda fixa. Cada célula mostra o desvio do preço em relação ao preço
 * de carrego daquela mesma duration (ou seja, variação de taxa = 0 é sempre 0%,
 * consistente com o card "Sensibilidade aproximada" acima), mostrando que o efeito é
 * grande para prazos longos e quase nulo perto do vencimento — a essência de "levar até
 * o vencimento elimina o risco".
 */
export function simulateMarkToMarket(input: MarkToMarketInput): MarkToMarketResult {
  const carryingPrice = bondPrice(input.faceValue, input.originalRate, input.yearsRemaining);
  const marketPrice = bondPrice(input.faceValue, input.newRate, input.yearsRemaining);
  const profitOrLoss = marketPrice.minus(carryingPrice);
  const approximateSensitivity = profitOrLoss.div(carryingPrice);

  const durationScenarios = DURATION_SCENARIOS_YEARS.filter((d) => d <= input.totalYears);

  const sensitivityMatrix: SensitivityRow[] = durationScenarios.map((durationYears) => {
    const baselinePrice = bondPrice(1, input.originalRate, durationYears);
    const cells = RATE_CHANGE_SCENARIOS.map((delta) => {
      const rate = new Decimal(input.originalRate).plus(delta);
      const scenarioPrice = bondPrice(1, rate, durationYears);
      const priceDeviation = scenarioPrice.minus(baselinePrice).div(baselinePrice);
      return { rateChange: delta, priceDeviation: priceDeviation.toNumber() };
    });

    return { durationYears, cells };
  });

  return {
    carryingPrice: carryingPrice.toNumber(),
    marketPrice: marketPrice.toNumber(),
    profitOrLoss: profitOrLoss.toNumber(),
    approximateSensitivity: approximateSensitivity.toNumber(),
    sensitivityMatrix,
  };
}
