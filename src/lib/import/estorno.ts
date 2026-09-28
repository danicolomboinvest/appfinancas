/**
 * Estorno: dinheiro de uma compra voltando pra conta. No extrato ele chega como ENTRADA, e sem
 * reconhecer, virava renda: o mês parecia ter ganhado mais e gastado o mesmo. Reconhecido, ele
 * vira gasto negativo na categoria da compra, e compra e estorno se anulam.
 *
 * Só palavras que dizem com clareza "isso é devolução". "Crédito" sozinho não entra: salário,
 * Pix recebido e rendimento também chegam como crédito.
 */
const ESTORNO_RE = /\b(estorno|estornad[oa]|reembolso|devolu[cç][aã]o|chargeback|cancelamento de compra|compra cancelada|cr[eé]dito de compra)\b/i;

export function pareceEstorno(description: string | null | undefined): boolean {
  return ESTORNO_RE.test(description ?? "");
}
