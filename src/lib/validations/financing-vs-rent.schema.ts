import { z } from "zod";

export const financingVsRentSchema = z
  .object({
    propertyValue: z.coerce.number().positive("Informe o valor do imóvel."),
    downPayment: z.coerce.number().min(0),
    cetAnnualRate: z.coerce.number(),
    propertyAppreciationAnnualRate: z.coerce.number(),
    termMonths: z.coerce.number().int().positive(),
    system: z.enum(["SAC", "PRICE"]),
    monthlyRent: z.coerce.number().min(0),
    rentAnnualAdjustment: z.coerce.number(),
    investmentAnnualRate: z.coerce.number(),
  })
  .refine((data) => data.downPayment <= data.propertyValue, {
    message: "A entrada não pode ser maior que o valor do imóvel.",
    path: ["downPayment"],
  });

/** Forma bruta dos campos do formulário, antes da coerção do zod (strings vindas dos inputs). */
export type FinancingVsRentFormInput = z.input<typeof financingVsRentSchema>;
/** Forma já coagida/validada, usada no submit e passada ao motor de cálculo. */
export type FinancingVsRentFormValues = z.output<typeof financingVsRentSchema>;
