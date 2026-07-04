import { z } from "zod";

export const consortiumSchema = z.object({
  creditValue: z.coerce.number().positive("Informe o valor do bem."),
  consortiumAdminFeeRate: z.coerce.number().min(0),
  consortiumTermMonths: z.coerce.number().int().positive(),
  financingDownPayment: z.coerce.number().min(0),
  financingCetAnnualRate: z.coerce.number(),
  financingTermMonths: z.coerce.number().int().positive(),
  financingSystem: z.enum(["SAC", "PRICE"]),
  opportunityCostAnnualRate: z.coerce.number(),
});

export type ConsortiumFormInput = z.input<typeof consortiumSchema>;
export type ConsortiumFormValues = z.output<typeof consortiumSchema>;
