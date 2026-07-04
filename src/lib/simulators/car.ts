import { Decimal } from "@/lib/finance/decimal";

export type CarComparisonInput = {
  carPrice: number;
  priceAfter1Year: number;
  priceAfter2Years: number;
  monthlyFuelCost: number;
  subscriptionMonthlyFee: number;
  /** Soma anual de IPVA, seguro, emplacamento etc. (só se aplica à opção de compra). */
  annualFixedCosts: number;
  /** Rendimento mensal presumido sobre o capital imobilizado na compra (ex.: 0.008 = 0.8% a.m.). */
  opportunityCostMonthlyRate: number;
};

export type CarComparisonResult = {
  depreciationRateAfter1Year: number;
  depreciationRateAfter2Years: number;
  subscriptionCashCost: number;
  purchaseCashCost: number;
  opportunityCost: number;
  netResultSubscription: number;
  netResultPurchase: number;
  winner: "ASSINATURA" | "COMPRA";
  differenceInFavorOfWinner: number;
};

const HORIZON_MONTHS = 24;

/**
 * Carro por assinatura vs. comprar 0km, numa janela de 24 meses, considerando a
 * depreciação do carro comprado e o custo de oportunidade do capital imobilizado na compra.
 */
export function simulateCarComparison(input: CarComparisonInput): CarComparisonResult {
  const depreciationRateAfter1Year = new Decimal(input.carPrice).minus(input.priceAfter1Year).div(input.carPrice);
  const depreciationRateAfter2Years = new Decimal(input.carPrice)
    .minus(input.priceAfter2Years)
    .div(input.carPrice);

  const subscriptionCashCost = new Decimal(input.subscriptionMonthlyFee)
    .plus(input.monthlyFuelCost)
    .times(HORIZON_MONTHS);

  const purchaseCashCost = new Decimal(input.monthlyFuelCost)
    .times(HORIZON_MONTHS)
    .plus(new Decimal(input.annualFixedCosts).times(2))
    .plus(input.carPrice);

  const opportunityCost = new Decimal(input.carPrice).times(input.opportunityCostMonthlyRate).times(HORIZON_MONTHS);

  const netResultSubscription = subscriptionCashCost;
  const netResultPurchase = purchaseCashCost.plus(opportunityCost).minus(input.priceAfter2Years);

  const winner = netResultSubscription.lessThanOrEqualTo(netResultPurchase) ? "ASSINATURA" : "COMPRA";
  const differenceInFavorOfWinner = netResultSubscription.minus(netResultPurchase).abs();

  return {
    depreciationRateAfter1Year: depreciationRateAfter1Year.toNumber(),
    depreciationRateAfter2Years: depreciationRateAfter2Years.toNumber(),
    subscriptionCashCost: subscriptionCashCost.toNumber(),
    purchaseCashCost: purchaseCashCost.toNumber(),
    opportunityCost: opportunityCost.toNumber(),
    netResultSubscription: netResultSubscription.toNumber(),
    netResultPurchase: netResultPurchase.toNumber(),
    winner,
    differenceInFavorOfWinner: differenceInFavorOfWinner.toNumber(),
  };
}
