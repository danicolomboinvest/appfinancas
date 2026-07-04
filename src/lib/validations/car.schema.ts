import { z } from "zod";

export const carComparisonSchema = z.object({
  carPrice: z.coerce.number().positive("Informe o valor do carro."),
  priceAfter1Year: z.coerce.number().min(0),
  priceAfter2Years: z.coerce.number().min(0),
  monthlyFuelCost: z.coerce.number().min(0),
  subscriptionMonthlyFee: z.coerce.number().min(0),
  annualFixedCosts: z.coerce.number().min(0),
  opportunityCostMonthlyRate: z.coerce.number(),
});

export type CarComparisonFormInput = z.input<typeof carComparisonSchema>;
export type CarComparisonFormValues = z.output<typeof carComparisonSchema>;
