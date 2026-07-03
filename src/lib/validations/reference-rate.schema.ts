import { z } from "zod";

export const referenceRateSchema = z.object({
  name: z.string().min(1, "Informe o nome da taxa."),
  rateValue: z.coerce.number(),
  basis: z.enum(["ANNUAL_252", "ANNUAL_365", "MONTHLY"]),
  effectiveDate: z.coerce.date(),
});
