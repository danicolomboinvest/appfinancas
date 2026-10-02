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
  // Opcional (Apple, 5.1.1(v), 01/10/2026: celular não é essencial pro app). Se veio, a
  // validação de verdade é a do normalizePhone, que aceita qualquer formato digitado.
  phone: z.string().nullish().transform((v) => v?.trim() ?? ""),
});

/** Conta criada pelo admin (cortesia/VIP), sem celular — diferente do autocadastro normal,
 * a Dani não tem esse dado da pessoa na hora, e o formulário nem pede. */
export const adminInviteSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Nome muito longo (até 80 letras)."),
  email: emailSchema,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});
