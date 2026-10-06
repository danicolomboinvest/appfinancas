/**
 * Primeira linha do texto que veio de LEITURA DE IMAGEM (OCR) em vez de texto do PDF.
 *
 * O OCR erra um dígito de vez em quando, e um número trocado vira dinheiro errado no app. Por
 * isso texto com esta marca só é lido por leitores que conseguem CONFERIR o resultado por conta
 * própria (ex.: o saldo linha a linha do extrato da Caixa). Nenhum leitor genérico toca nele.
 */
export const OCR_MARCA = "%%LEITURA-POR-IMAGEM%%";

export function veioDeImagem(texto: string): boolean {
  return texto.startsWith(OCR_MARCA);
}
