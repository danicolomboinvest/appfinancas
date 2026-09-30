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

/** A mensagem pronta do WhatsApp de quem vê "Seu acesso não está ativo" no lugar do app. */
export function mensagemDeContaSemAcesso(emailDaConta: string): string {
  return `ACESSO: oi! não consigo entrar no SPI Finance. O e-mail da minha conta no app é ${emailDaConta}. O e-mail da minha compra é: `;
}

/**
 * O que o cadastro diz quando o e-mail não tem compra valendo. Quem mais erra aqui é quem comprou
 * com outro e-mail, então a primeira frase é sempre "use o e-mail da compra"; a dica do celular
 * (compraComOCelular) aponta qual, mascarado.
 */
export function erroDeCadastroSemCompra(situacao: "sem-compra" | "encerrado" | "vencido", compraDoCelular: string | null): string {
  if (situacao !== "sem-compra") {
    return `A compra deste e-mail não está mais ativa (reembolso, cancelamento ou prazo vencido). Se acha que é engano, fale com a gente: ${EMAIL_DO_SUPORTE}.`;
  }
  const dica = compraDoCelular ? ` Achamos uma compra com o seu celular no e-mail ${compraDoCelular}: cadastre com ele.` : "";
  return `Não achamos compra do SPI Finance com este e-mail. Use o mesmo e-mail que você usou pra comprar.${dica} Acabou de comprar? Espere uns minutos e tente de novo. Ajuda: ${EMAIL_DO_SUPORTE}.`;
}
