import { z } from "zod";

export const markToMarketSchema = z
  .object({
    faceValue: z.coerce.number().positive("Informe o valor de face."),
    // Taxa de -100% (ou menos) zeraria/inverteria a base do cálculo (1+taxa), trava antes de
    // chegar no simulador, com uma margem que sobra pra matriz de sensibilidade (que soma até
    // ±3 p.p. à taxa) nunca cruzar esse limite.
    originalRate: z.coerce.number().gt(-0.9, "Taxa contratada muito negativa, confira o valor informado."),
    newRate: z.coerce.number().gt(-0.9, "Nova taxa muito negativa, confira o valor informado."),
    totalYears: z.coerce.number().positive(),
    yearsRemaining: z.coerce.number().min(0),
    hasSemiannualCoupons: z.boolean().default(false),
    duration: z.coerce.number().min(0).optional(),
    investedAmount: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.yearsRemaining <= data.totalYears, {
    message: "O tempo restante não pode ser maior que o prazo total.",
    path: ["yearsRemaining"],
  })
  .refine((data) => !data.hasSemiannualCoupons || data.duration !== undefined, {
    message: "Informe a duration para títulos com cupons semestrais.",
    path: ["duration"],
  })
  .refine((data) => !data.hasSemiannualCoupons || data.duration === undefined || data.duration <= data.yearsRemaining, {
    message: "A duration não pode ser maior que os anos restantes até o vencimento.",
    path: ["duration"],
  });

export type MarkToMarketFormInput = z.input<typeof markToMarketSchema>;
export type MarkToMarketFormValues = z.output<typeof markToMarketSchema>;
