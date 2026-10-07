/**
 * O link do botão "Falar com a gente": abre o app de e-mail da pessoa já com o assunto e a
 * mensagem escritos, endereçado a app@danicolombo.com.br.
 *
 * Até 06/10/2026 abria o WhatsApp (ManyChat). Trocou porque o WhatsApp só deixa responder em até
 * 24h depois da última mensagem da pessoa; passou disso, a Dani não consegue mais responder. E-mail
 * não tem prazo. O nome do arquivo ficou pelo histórico.
 *
 * A mensagem já vai escrita por dois motivos: a pessoa frustrada não precisa formular nada, e o
 * texto carrega o que aconteceu (o arquivo, o erro, o e-mail da conta), então a Dani não precisa
 * perguntar. O assunto separa os casos na caixa de entrada.
 */

import { EMAIL_DO_SUPORTE } from "./contato";

export const ASSUNTO_PADRAO = "Ajuda com o SPI Finance";
export const ASSUNTO_IMPORTACAO = "Erro ao importar no SPI Finance";

export function linkDoSuporte(mensagem: string, assunto = ASSUNTO_PADRAO): string {
  return `mailto:${EMAIL_DO_SUPORTE}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
}

/** A mensagem que a pessoa manda quando a importação deu errado. */
export function mensagemDeErroDeImportacao(opcoes: { arquivo?: string | null; problema?: string | null }): string {
  const partes = ["Oi! Tentei subir meu extrato no SPI Finance e não deu certo."];
  if (opcoes.arquivo) partes.push(`Arquivo: ${opcoes.arquivo}.`);
  if (opcoes.problema) partes.push(`O app disse: ${opcoes.problema}`);
  return partes.join(" ");
}
