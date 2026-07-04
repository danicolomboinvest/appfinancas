import { z } from "zod";

export const amortizeVsInvestSchema = z.object({
  outstandingBalance: z.coerce.number().positive("Informe o saldo devedor."),
  cetAnnualRate: z.coerce.number(),
  remainingMonths: z.coerce.number().int().positive(),
  system: z.enum(["SAC", "PRICE"]),
  extraAmount: z.coerce.number().positive("Informe o valor disponível."),
  investmentAnnualRate: z.coerce.number(),
  incomeTaxRate: z.coerce.number().min(0).max(1),
});

export type AmortizeVsInvestFormInput = z.input<typeof amortizeVsInvestSchema>;
export type AmortizeVsInvestFormValues = z.output<typeof amortizeVsInvestSchema>;
