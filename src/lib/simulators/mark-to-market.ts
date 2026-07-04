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
  cells: { rateChange: number; approxReturn: number }[];
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
 * presente pela taxa. A matriz cruza diferentes durations (tempo restante até o
 * vencimento) com variações de taxa, mostrando que o efeito é grande para prazos longos
 * e quase nulo perto do vencimento — a essência de "levar até o vencimento elimina o risco".
 */
export function simulateMarkToMarket(input: MarkToMarketInput): MarkToMarketResult {
  const carryingPrice = bondPrice(input.faceValue, input.originalRate, input.yearsRemaining);
  const marketPrice = bondPrice(input.faceValue, input.newRate, input.yearsRemaining);
  const profitOrLoss = marketPrice.minus(carryingPrice);
  const rateChange = input.newRate - input.originalRate;
  const approximateSensitivity = new Decimal(-input.yearsRemaining).times(rateChange);

  const durationScenarios = DURATION_SCENARIOS_YEARS.filter((d) => d <= input.totalYears);

  const sensitivityMatrix: SensitivityRow[] = durationScenarios.map((durationYears) => {
    const carryTime = input.totalYears - durationYears;
    const carryGrowth = new Decimal(1).plus(new Decimal(input.originalRate).times(carryTime));

    const cells = RATE_CHANGE_SCENARIOS.map((delta) => {
      const durationEffect = new Decimal(1).plus(new Decimal(-durationYears).times(delta));
      const approxReturn = durationEffect.times(carryGrowth).minus(1);
      return { rateChange: delta, approxReturn: approxReturn.toNumber() };
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
