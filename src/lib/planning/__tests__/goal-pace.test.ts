import { describe, expect, it } from "vitest";
import { computeGoalPlan } from "../goal";

const HOJE = new Date("2026-09-16T12:00:00Z");
const dias = (n: number) => new Date(HOJE.getTime() + n * 86_400_000);

const BASE = { targetAmount: 20_000, annualRate: 0, now: HOJE };

describe("ritmo da meta", () => {
  /**
   * A regressão: antes, ON_TRACK era devolvido pra QUALQUER meta cujo prazo ainda não tivesse
   * vencido. Uma meta de R$ 20 mil com R$ 0 guardado e um mês pra acabar dizia "No ritmo" até
   * o último dia, e virava "Atrasada" de um dia pro outro, sem nenhum aviso no meio.
   */
  it("calls a goal behind when the money did not keep up with the clock", () => {
    const p = computeGoalPlan({
      ...BASE,
      currentAmount: 0,
      startedAt: dias(-330),
      targetDate: dias(-330 + 360),
    });
    expect(p.status).toBe("BEHIND");
  });

  it("stays on track while the money keeps up with the clock", () => {
    // Metade do prazo, metade do valor.
    const p = computeGoalPlan({
      ...BASE,
      currentAmount: 10_000,
      startedAt: dias(-180),
      targetDate: dias(180),
    });
    expect(p.status).toBe("ON_TRACK");
    expect(p.timeElapsed).toBeCloseTo(0.5, 2);
    expect(p.progress).toBeCloseTo(0.5, 6);
  });

  it("forgives a small stumble instead of nagging", () => {
    // 50% do prazo, 45% guardado: devendo, mas dentro da tolerância de 15%.
    const p = computeGoalPlan({
      ...BASE,
      currentAmount: 9_000,
      startedAt: dias(-180),
      targetDate: dias(180),
    });
    expect(p.status).toBe("ON_TRACK");
  });

  it("judges nothing when the goal has no start date", () => {
    const p = computeGoalPlan({ ...BASE, currentAmount: 0, targetDate: dias(30) });
    expect(p.timeElapsed).toBeNull();
    expect(p.status).toBe("ON_TRACK");
  });

  it("keeps calling an overdue goal behind, and a reached one reached", () => {
    expect(computeGoalPlan({ ...BASE, currentAmount: 19_000, targetDate: dias(-1) }).status).toBe("BEHIND");
    expect(
      computeGoalPlan({ ...BASE, currentAmount: 20_000, startedAt: dias(-300), targetDate: dias(30) }).status,
    ).toBe("ACHIEVED");
  });
});
