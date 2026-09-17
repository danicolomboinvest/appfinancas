import type { StrategyAssetClass } from "@prisma/client";

export type ClassGap = { assetClass: StrategyAssetClass; currentValue: number; targetPercent: number };

export type ContributionSlice = { assetClass: StrategyAssetClass; amount: number };

/**
 * Onde colocar o aporte do mês pra carteira chegar mais perto da estratégia SEM vender nada.
 *
 * A conta: depois do aporte a carteira vale (total + aporte). O alvo de cada classe é
 * target% × esse novo total; a "falta" é alvo − atual. O aporte vai só pra quem está em falta,
 * na proporção da falta de cada uma. Se ninguém está em falta (carteira já no alvo), divide
 * pelos alvos. Arredonda em R$ 10, e a diferença de arredondamento vai pra maior fatia.
 */
export function planContribution(classes: ClassGap[], amount: number): ContributionSlice[] {
  if (amount <= 0) return [];
  const total = classes.reduce((s, c) => s + c.currentValue, 0);
  const newTotal = total + amount;
  const gaps = classes.map((c) => ({ assetClass: c.assetClass, gap: Math.max(0, c.targetPercent * newTotal - c.currentValue), target: c.targetPercent }));
  const gapSum = gaps.reduce((s, g) => s + g.gap, 0);
  const weights = gapSum > 0 ? gaps.map((g) => g.gap / gapSum) : gaps.map((g) => g.target);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) return [];

  const raw = gaps.map((g, i) => ({ assetClass: g.assetClass, amount: Math.floor(((amount * weights[i]) / weightSum) / 10) * 10 }));
  const slices = raw.filter((s) => s.amount > 0);
  const assigned = slices.reduce((s, x) => s + x.amount, 0);
  const rest = Math.round((amount - assigned) * 100) / 100;
  if (slices.length === 0) return [{ assetClass: gaps.sort((a, b) => b.gap - a.gap)[0].assetClass, amount }];
  if (rest > 0) {
    const biggest = slices.reduce((m, s) => (s.amount > m.amount ? s : m));
    biggest.amount = Math.round((biggest.amount + rest) * 100) / 100;
  }
  return slices.sort((a, b) => b.amount - a.amount);
}
