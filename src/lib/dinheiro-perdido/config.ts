/**
 * O preço do SPI que a barra do "Até agora" usa para dizer "O SPI já se pagou".
 *
 * O app não guarda quanto cada pessoa pagou (a Hubla e a Apple cobram preços diferentes, e quem
 * comprou antes pagou menos). Por isso a tela compara com o preço de venda de hoje e diz isso com
 * todas as letras ("O SPI custa R$ 97 por ano"), sem fingir que é o valor que a pessoa pagou.
 *
 * Trocar o preço: só aqui. A comparação só aparece para quem usa o app em real.
 */
export const PRECO_DO_SPI_POR_ANO = 97;
export const MOEDA_DO_PRECO_DO_SPI = "BRL";

/** Quantos meses de lançamentos o app olha para caçar (assinatura precisa de histórico). */
export const MESES_OLHADOS = 6;
