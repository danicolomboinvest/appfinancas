import { z } from "zod";

export const criterionSchema = z.object({
  sheetType: z.enum(["STOCK", "FII", "STOCK_INTL", "ETF"]),
  key: z
    .string()
    .trim()
    .min(1, "Informe a chave do critério.")
    .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e underscore."),
  label: z.string().trim().min(1, "Informe o rótulo do critério."),
  category: z.string().trim().min(1, "Informe a categoria."),
  helpText: z.string().trim().optional(),
  order: z.coerce.number().int(),
});

export type CriterionFormValues = z.infer<typeof criterionSchema>;
