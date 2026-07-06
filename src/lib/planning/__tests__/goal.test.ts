import { describe, expect, it } from "vitest";
import { computeGoalPlan, computeGoalTrajectory } from "../goal";

describe("computeGoalTrajectory", () => {
  it("starts at the current amount and lands close to the target for an ON_TRACK goal", () => {
    const now = new Date(2026, 0, 1);
    const targetDate = new Date(2028, 0, 1); // 24 meses à frente
    const input = {
      targetAmount: 20000,
      currentAmount: 2000,
      targetDate,
      annualRate: 0.11,
      now,
    };
    const plan = computeGoalPlan(input);
    expect(plan.status).toBe("ON_TRACK");

    const trajectory = computeGoalTrajectory(input, plan);
    expect(trajectory[0]).toEqual({ month: 0, amount: 2000 });
    expect(trajectory).toHaveLength(plan.monthsRemaining + 1);

    const last = trajectory[trajectory.length - 1];
    expect(last.amount).toBeCloseTo(input.targetAmount, 0);
  });

  it("is monotonically increasing when there is a positive required contribution", () => {
    const now = new Date(2026, 0, 1);
    const input = {
      targetAmount: 10000,
      currentAmount: 500,
      targetDate: new Date(2027, 0, 1),
      annualRate: 0.08,
      now,
    };
    const plan = computeGoalPlan(input);
    const trajectory = computeGoalTrajectory(input, plan);

    for (let i = 1; i < trajectory.length; i++) {
      expect(trajectory[i].amount).toBeGreaterThan(trajectory[i - 1].amount);
    }
  });

  it("returns a single point for an already-achieved goal", () => {
    const now = new Date(2026, 0, 1);
    const input = {
      targetAmount: 1000,
      currentAmount: 1500,
      targetDate: new Date(2027, 0, 1),
      annualRate: 0.1,
      now,
    };
    const plan = computeGoalPlan(input);
    expect(plan.status).toBe("ACHIEVED");

    const trajectory = computeGoalTrajectory(input, plan);
    expect(trajectory).toEqual([{ month: 0, amount: 1500 }]);
  });
});
