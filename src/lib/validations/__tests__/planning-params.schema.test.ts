import { describe, expect, it } from "vitest";
import { planningParamsSchema } from "../planning-params.schema";

const base = {
  currentAge: "30",
  retirementAge: "85",
  currentPatrimony: "50000",
  monthlyContributionAccumulation: "2000",
  accumulationAnnualRate: "0.1",
  inflationAnnualRate: "0.045",
  usufructAnnualRate: "0.04",
  desiredPassiveIncome: "8000",
  otherPassiveIncome: "0",
};

describe("planningParamsSchema.lifeExpectancyAge", () => {
  // A action transforma o campo apagado ("") em null: tem que chegar como null (limpa a coluna),
  // não como 0 (o coerce faria Number(null) = 0) nem como undefined (o Prisma ignoraria).
  it("keeps null as null so a cleared field clears the column", () => {
    const r = planningParamsSchema.safeParse({ ...base, lifeExpectancyAge: null });
    expect(r.success).toBe(true);
    expect(r.success && r.data.lifeExpectancyAge).toBeNull();
  });

  it("keeps undefined when the field was not sent", () => {
    const r = planningParamsSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.lifeExpectancyAge).toBeUndefined();
  });

  it("still rejects an expectancy below the retirement age", () => {
    const r = planningParamsSchema.safeParse({ ...base, lifeExpectancyAge: "80" });
    expect(r.success).toBe(false);
  });

  it("accepts an expectancy at or above the retirement age", () => {
    const r = planningParamsSchema.safeParse({ ...base, lifeExpectancyAge: "90" });
    expect(r.success && r.data.lifeExpectancyAge).toBe(90);
  });
});
