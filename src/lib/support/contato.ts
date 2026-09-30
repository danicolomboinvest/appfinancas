/**
 * O e-mail de atendimento que aparece nas telas pra cliente copiar. É a mesma caixa que manda os
 * e-mails do app (SMTP_USER na Vercel), então a resposta sai do endereço que ela já conhece.
 * Fica como texto, não como variável de ambiente: é público e tem que aparecer mesmo se alguma
 * env faltar — o cadeado é justamente a tela de quem está com problema.
 */
export const EMAIL_DO_SUPORTE = "app@danicolombo.com.br";

/** A mensagem pronta do WhatsApp pra quem comprou e está vendo o cadeado. Leva o e-mail da conta
 * porque é a primeira coisa que o suporte precisa pra achar a compra e liberar. */
export function mensagemDeAcessoTrancado(recurso: string, emailDaConta: string | null): string {
  const partes = [`ACESSO: oi! comprei o SPI Finance, mas "${recurso}" aparece trancado pra mim.`];
  if (emailDaConta) partes.push(`O e-mail da minha conta no app é ${emailDaConta}.`);
  return partes.join(" ");
}
