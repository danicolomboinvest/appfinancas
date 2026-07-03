import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Informe seu nome."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});
