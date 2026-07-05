import { z } from "zod";

const PARENT_CATEGORY_VALUES = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "FINANCEIRO",
] as const;

export const budgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  parentCategory: z.enum(PARENT_CATEGORY_VALUES),
  plannedAmount: z.coerce.number().nonnegative("O valor planejado não pode ser negativo."),
});
