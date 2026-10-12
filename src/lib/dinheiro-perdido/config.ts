/**
 * O preço do SPI que o cancelar usa para dizer "O SPI já se pagou" (12/10/2026: ela tirou a
 * comparação da tela do Dinheiro perdido; o argumento só aparece para quem quer cancelar, e sem
 * mostrar o preço).
 *
 * O app não guarda quanto cada pessoa pagou (a Hubla e a Apple cobram preços diferentes, e quem
 * comprou antes pagou menos). Por isso compara com o preço de venda de hoje e nunca escreve o preço.
 *
 * Trocar o preço: só aqui. A comparação só aparece para quem usa o app em real.
 */
export const PRECO_DO_SPI_POR_ANO = 97;
export const MOEDA_DO_PRECO_DO_SPI = "BRL";

/** Quantos meses de lançamentos o app olha para caçar (assinatura precisa de histórico). */
export const MESES_OLHADOS = 6;
