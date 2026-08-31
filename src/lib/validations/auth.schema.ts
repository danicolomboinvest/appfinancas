import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Informe seu nome."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  // Validação/normalização de verdade acontece com normalizePhone (aceita qualquer formato
  // digitado); aqui só garante que veio algo.
  phone: z.string().min(1, "Informe seu celular com DDD."),
});

/** Conta criada pelo admin (cortesia/VIP), sem celular — diferente do autocadastro normal,
 * a Dani não tem esse dado da pessoa na hora, e o formulário nem pede. */
export const adminInviteSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});
