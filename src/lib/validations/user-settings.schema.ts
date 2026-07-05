import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").optional(),
  email: z.string().trim().email("E-mail inválido."),
  avatarUrl: z.string().trim().url("URL inválida.").optional().or(z.literal("")),
});

export const preferencesSchema = z.object({
  currency: z.enum(["BRL", "USD", "EUR"]),
  theme: z.enum(["dark", "light"]),
});

export const notificationsSchema = z.object({
  notifyBudgetAlerts: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  notifyLateGoals: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
});
