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
