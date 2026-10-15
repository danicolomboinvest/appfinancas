/**
 * Estorno: dinheiro de uma compra voltando pra conta. No extrato ele chega como ENTRADA, e sem
 * reconhecer, virava renda: o mês parecia ter ganhado mais e gastado o mesmo. Reconhecido, ele
 * vira gasto negativo na categoria da compra, e compra e estorno se anulam.
 *
 * Só palavras que dizem com clareza "isso é devolução". "Crédito" sozinho não entra: salário,
 * Pix recebido e rendimento também chegam como crédito.
 *
 * Plural e particípio entram ("ESTORNOS", "Pix devolvido", "Valor reembolsado"): sem eles a
 * devolução virava renda do mesmo jeito. "Devolvido" é seguro aqui porque, no extrato, a regra
 * só olha ENTRADA (dinheiro voltando pra ela), nunca a saída.
 */
const ESTORNO_RE =
  /\b(estornos?|estornad[oa]s?|reembolsos?|reembolsad[oa]s?|devolu[cç][aã]o|devolu[cç][oõ]es|devolvid[oa]s?|chargeback|cancelamento de compra|compra cancelada|cr[eé]dito de compra)\b/i;

export function pareceEstorno(description: string | null | undefined): boolean {
  return ESTORNO_RE.test(description ?? "");
}

/**
 * Linha da FATURA que veio com o sinal de compra, mas o texto diz com todas as letras que é
 * devolução (15/10/2026: "ESTORNO ..." sem o menos virava compra e o mês ficava mais caro, nunca
 * mais barato). Mais conservadora que `pareceEstorno`, porque aqui a linha já é um gasto e errar
 * apaga um gasto de verdade:
 *
 * - "estorno" no começo da linha, depois de um separador ("Loja - Estorno") ou no fim dela;
 * - "devolução" no começo da linha ("DEVOLUCAO MERCADO LIVRE"), menos tarifa, taxa e cheque;
 * - "chargeback";
 * - a compra dita cancelada ou devolvida: "compra cancelada", "cancelamento de compra",
 *   "devolução de compra", "reembolso de compra", "estorno de compra".
 *
 * Não entra: "estorno de pagamento/crédito/cashback/desconto/bônus" (é o crédito sendo desfeito,
 * uma cobrança), "taxa de cancelamento", "CANCELADO" ou "devolução" soltos no nome da loja, e
 * "reembolso" sozinho.
 */
const ESTORNO_DE_CREDITO = /\bestorn\w*\s+(?:d[eoa]s?\s+)?(?:pagamentos?|pgto|pagto|credito|cashback|desconto|bonus|estorno|ajuste)\b/;
const ESTORNO_CLARO =
  /(?:^\s*estorn(?:o|os|ad[oa])\b|^\s*devolu(?:cao|coes)\b(?!\s+(?:d[ae]\s+)?(?:tarifa|taxa|cheque))|(?:^|\s)[-–:|/]\s*estorn(?:o|os|ad[oa])\b|\bestorn(?:o|ado|ada)\s*$|\bchargeback\b|\bcompra\s+cancelada\b|\bcancelamento\s+(?:d[ae]\s+)?(?:compra|transacao)\b|\bdevolucao\s+(?:d[ae]\s+)?compra\b|\breembolso\s+(?:d[ae]\s+)?compra\b|\bestorno\s+(?:d[ae]\s+)?compra\b)/;

export function estornoClaroNaFatura(description: string | null | undefined): boolean {
  const d = (description ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (ESTORNO_DE_CREDITO.test(d)) return false;
  return ESTORNO_CLARO.test(d);
}
