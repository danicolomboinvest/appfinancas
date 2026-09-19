/**
 * O link que abre a conversa no WhatsApp da Dani (que é onde o ManyChat atende) já com a
 * mensagem escrita.
 *
 * É QUEM manda a primeira mensagem que decide se isso funciona. O WhatsApp só permite mensagem
 * livre dentro de 24h do último contato da pessoa; quando ela inicia, a janela abre e o fluxo do
 * ManyChat pode responder à vontade. Por isso o botão na tela de erro é o caminho principal de
 * suporte, e o disparo automático do app é só o reforço pra quem não clicou.
 *
 * A mensagem já vai escrita por dois motivos: a pessoa frustrada não precisa formular nada, e o
 * texto carrega o que aconteceu — o ManyChat consegue reconhecer o assunto e responder na hora.
 */

/** Aparece no começo da mensagem pro fluxo do ManyChat reconhecer o assunto. */
export const PALAVRA_CHAVE_IMPORTACAO = "ERRO-IMPORTACAO";

export function linkDoSuporte(mensagem: string): string | null {
  const numero = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** A mensagem que a pessoa manda quando a importação deu errado. */
export function mensagemDeErroDeImportacao(opcoes: { arquivo?: string | null; problema?: string | null }): string {
  const partes = [`${PALAVRA_CHAVE_IMPORTACAO}: oi! tentei subir meu extrato no SPI Finance e não deu certo.`];
  if (opcoes.arquivo) partes.push(`Arquivo: ${opcoes.arquivo}.`);
  if (opcoes.problema) partes.push(`O app disse: ${opcoes.problema}`);
  return partes.join(" ");
}
