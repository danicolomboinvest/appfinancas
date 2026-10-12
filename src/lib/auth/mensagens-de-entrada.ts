/**
 * Mensagens do login que a tela precisa reconhecer para desenhar o aviso certo (a senha errada
 * marca o campo da senha e oferece "Criar uma senha nova"). Fica fora do actions.ts porque um
 * arquivo "use server" só pode exportar funções.
 */
export const ERRO_DE_EMAIL_OU_SENHA = "E-mail ou senha não conferem.";

/** A troca de senha com um link que já não vale (vencido, usado ou cortado). */
export const ERRO_DE_LINK_DE_SENHA = "Este link é inválido ou expirou. Peça um novo em 'Esqueci minha senha'.";
