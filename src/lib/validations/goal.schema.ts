import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da meta."),
  targetAmount: z.coerce.number().positive("O valor da meta deve ser maior que zero."),
  // String "YYYY-MM-DD" vinda do MonthYearField. O regex barra valor vazio/quebrado com
  // mensagem em português — antes o z.coerce.date() estourava "Invalid input: expected date,
  // received Date" (o Date inválido do Safari sem calendário nativo).
  targetDate: z
    .string({ message: "Escolha o mês/ano alvo no calendário." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o mês/ano alvo no calendário.")
    .transform((v) => new Date(`${v}T12:00:00`)),
  currentAmount: z.coerce.number().min(0).default(0),
  annualRate: z.coerce.number().min(-0.99, "Taxa inválida.").max(3, "Taxa inválida."),
  icon: z.enum(["VIAGEM", "CASA", "CARRO", "APOSENTADORIA", "GENERICO"]).default("GENERICO"),
});
