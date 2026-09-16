import { describe, expect, it } from "vitest";
import { summarizeStrategy } from "../strategy-bullets";
import type { StrategyClassPosition } from "../strategy";

const pos = (assetClass: string, currentPercent: number, targetPercent: number) =>
  ({
    assetClass,
    currentValue: 0,
    currentPercent,
    targetPercent,
    deviationPercent: currentPercent - targetPercent,
    targetValue: 0,
    rebalanceAmount: 0,
    status: "DENTRO",
  }) as unknown as StrategyClassPosition;

describe("summarizeStrategy", () => {
  it("conta quem está abaixo e quem está acima do alvo", () => {
    const r = summarizeStrategy([pos("RENDA_FIXA", 0.46, 0.4), pos("ACAO", 0.14, 0.2), pos("FII", 0.2, 0.2)]);
    expect(r).toEqual({ above: 1, below: 1 });
  });

  it("classe sem alvo definido não entra na conta", () => {
    expect(summarizeStrategy([pos("CRIPTO", 0.3, 0)])).toEqual({ above: 0, below: 0 });
  });

  it("dá um ponto percentual de folga — 19,6% num alvo de 20% não é desequilíbrio", () => {
    expect(summarizeStrategy([pos("FII", 0.196, 0.2)])).toEqual({ above: 0, below: 0 });
  });
});
