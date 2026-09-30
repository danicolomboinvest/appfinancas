import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(80, "Nome muito longo (até 80 letras).").optional(),
  email: z.string().trim().email("E-mail inválido."),
});

export const preferencesSchema = z.object({
  currency: z.enum(["BRL", "USD", "EUR", "GBP"], { message: "Escolha uma moeda da lista." }),
  // Opcional porque só o tema Padrão mostra o seletor de claro/escuro: nos outros o formulário
  // nem manda o campo, e exigir ele barrava a troca de moeda com um erro em inglês. Sem o
  // campo, o modo guardado fica como está (vale de novo se ela voltar pro Padrão).
  theme: z.enum(["dark", "light"], { message: "Escolha claro ou escuro." }).optional(),
});

export const notificationsSchema = z.object({
  notifyBudgetAlerts: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  notifyLateGoals: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  notifyMonthlyRecap: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
});
