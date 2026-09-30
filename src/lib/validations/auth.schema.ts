import { z } from "zod";

/**
 * E-mail sempre entra minúsculo e sem espaço. Teclado de celular e contato salvo capitalizam
 * ("Maria.Silva@Gmail.com"), e o banco diferencia caixa: sem isso o login com a senha certa
 * dizia "incorreto" e um segundo cadastro criava outra conta vazia com o mesmo e-mail.
 */
export const emailSchema = z.string().trim().toLowerCase().email("Email inválido.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});

/** Nome com teto: ele vai na saudação dos e-mails, e sem limite cabia um parágrafo inteiro. */
const nomeSchema = z.string().trim().min(1, "Informe seu nome.").max(80, "Nome muito longo (até 80 letras).");

export const registerSchema = z.object({
  name: nomeSchema,
  email: emailSchema,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  // Validação/normalização de verdade acontece com normalizePhone (aceita qualquer formato
  // digitado); aqui só garante que veio algo.
  phone: z.string().min(1, "Informe seu celular com DDD."),
});

/** Conta criada pelo admin (cortesia/VIP), sem celular — diferente do autocadastro normal,
 * a Dani não tem esse dado da pessoa na hora, e o formulário nem pede. */
export const adminInviteSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Nome muito longo (até 80 letras)."),
  email: emailSchema,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});
