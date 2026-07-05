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

export const monthlyEntrySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  category: z.enum(["INCOME", "EXPENSE", "INVESTMENT_CONTRIBUTION"]),
  parentCategory: z.enum(PARENT_CATEGORY_VALUES).optional().or(z.literal("")),
  subcategory: z.string().trim().optional(),
  description: z.string().trim().optional(),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  /** "on" quando o checkbox de recorrência é marcado no formulário. */
  repeatMonthly: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});
