import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da meta."),
  targetAmount: z.coerce.number().positive("O valor da meta deve ser maior que zero."),
  targetDate: z.coerce.date(),
  currentAmount: z.coerce.number().min(0).default(0),
  annualRate: z.coerce.number(),
  icon: z.enum(["VIAGEM", "CASA", "CARRO", "APOSENTADORIA", "GENERICO"]).default("GENERICO"),
});
