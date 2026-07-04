import { z } from "zod";

export const markToMarketSchema = z
  .object({
    faceValue: z.coerce.number().positive("Informe o valor de face."),
    originalRate: z.coerce.number(),
    newRate: z.coerce.number(),
    totalYears: z.coerce.number().positive(),
    yearsRemaining: z.coerce.number().min(0),
  })
  .refine((data) => data.yearsRemaining <= data.totalYears, {
    message: "O tempo restante não pode ser maior que o prazo total.",
    path: ["yearsRemaining"],
  });

export type MarkToMarketFormInput = z.input<typeof markToMarketSchema>;
export type MarkToMarketFormValues = z.output<typeof markToMarketSchema>;
