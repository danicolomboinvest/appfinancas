import { z } from "zod";

export const planningParamsSchema = z
  .object({
    currentAge: z.coerce.number().int().min(0).max(120),
    retirementAge: z.coerce.number().int().min(0).max(120),
    lifeExpectancyAge: z.coerce.number().int().min(0).max(130).optional(),
    currentPatrimony: z.coerce.number().min(0),
    monthlyContributionAccumulation: z.coerce.number().min(0),
    // Taxas viajam como FRAÇÃO (PercentField: digita 11 → envia 0.11). Faixa sã: abaixo de
    // -0.99 (=-99%) os juros compostos viram NaN ((1+r)^(1/12) de base negativa) e o NaN fica
    // PERSISTIDO nas telas de planejamento; 3 (=300% a.a.) é o teto.
    accumulationAnnualRate: z.coerce.number().min(-0.99, "Taxa inválida.").max(3, "Taxa inválida."),
    inflationAnnualRate: z.coerce.number().min(-0.99, "Taxa inválida.").max(3, "Taxa inválida."),
    usufructAnnualRate: z.coerce.number().min(-0.99, "Taxa inválida.").max(3, "Taxa inválida."),
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
