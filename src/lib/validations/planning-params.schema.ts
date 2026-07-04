import { z } from "zod";

export const planningParamsSchema = z
  .object({
    currentAge: z.coerce.number().int().min(0).max(120),
    retirementAge: z.coerce.number().int().min(0).max(120),
    lifeExpectancyAge: z.coerce.number().int().min(0).max(130).optional(),
    currentPatrimony: z.coerce.number().min(0),
    monthlyContributionAccumulation: z.coerce.number().min(0),
    accumulationAnnualRate: z.coerce.number(),
    inflationAnnualRate: z.coerce.number(),
    usufructAnnualRate: z.coerce.number(),
    desiredPassiveIncome: z.coerce.number().min(0),
    otherPassiveIncome: z.coerce.number().min(0).default(0),
  })
  .refine((data) => data.retirementAge >= data.currentAge, {
    message: "A idade objetivo deve ser maior ou igual à idade atual.",
    path: ["retirementAge"],
  })
  .refine((data) => data.lifeExpectancyAge === undefined || data.lifeExpectancyAge >= data.retirementAge, {
    message: "A expectativa de vida deve ser maior ou igual à idade objetivo.",
    path: ["lifeExpectancyAge"],
  });
