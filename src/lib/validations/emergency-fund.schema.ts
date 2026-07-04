import { z } from "zod";

export const emergencyFundSchema = z.object({
  targetMonths: z.coerce.number().int().min(1).max(60),
  monthlyExpenseBase: z.coerce.number().min(0),
  currentAmount: z.coerce.number().min(0).default(0),
  monthlyContribution: z.coerce.number().min(0),
  annualRate: z.coerce.number(),
});
