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

/** Sem `month`, aplica o mesmo valor aos 12 meses do ano (ver applyBudgetToWholeYear). */
export const annualBudgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  parentCategory: z.enum(PARENT_CATEGORY_VALUES),
  plannedAmount: z.coerce.number().nonnegative("O valor planejado não pode ser negativo."),
});

/** Mesma coisa que annualBudgetSchema, só que pra uma categoria personalizada (por id, não enum). */
export const annualBudgetForCustomCategorySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  customCategoryId: z.string().min(1),
  plannedAmount: z.coerce.number().nonnegative("O valor planejado não pode ser negativo."),
});
