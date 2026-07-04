import { z } from "zod";

export const monthlyEntrySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  category: z.enum(["INCOME", "EXPENSE", "INVESTMENT_CONTRIBUTION"]),
  subcategory: z.string().trim().optional(),
  description: z.string().trim().optional(),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
});
