import type { ParsedTransaction } from "./statement-parser";

/**
 * Linhas de RESUMO da fatura de cartão: "pagamento efetuado/recebido/via conta" (o que o
 * cliente já pagou da fatura anterior) e "total de compras/créditos/pagamentos" (somatório que
 * a própria fatura já detalha item a item). Não são uma compra — importar essas linhas dobra o
 * gasto ou lança um "gasto" que na verdade é o pagamento da fatura.
 */
const FATURA_SUMMARY_RE =
  /\b(pagamentos?\s+(efetuado|recebido|realizado|de\s+fatura|via\s+conta|em\s+conta|d[eé]bito\s+autom[aá]tico)|total\s+de\s+(cr[eé]ditos?|compras|pagamentos?|despesas))\b/i;

/** Testa a linha inteira (descrição E data) contra o padrão de resumo: faturas com várias
 * seções (pagamentos/créditos/compras) repetem o cabeçalho de coluna, e o subtotal entre
 * seções acaba caindo na coluna de data (ex.: BTG), não na de descrição. */
export function isFaturaSummaryLine(txn: ParsedTransaction): boolean {
  if (FATURA_SUMMARY_RE.test(txn.description) || FATURA_SUMMARY_RE.test(txn.date)) return true;
  // "2525/0004841-5 175/04314114-1": a linha digitável do boleto de pagamento da fatura, sem
  // nenhuma letra — nunca é o nome de um estabelecimento, então nunca é uma compra de verdade.
  if (/^[\d\s./-]+$/.test(txn.description)) return true;
  return false;
}

/**
 * Numa fatura de cartão, compra e estorno/pagamento vêm com sinais OPOSTOS entre si, mas qual
 * dos dois é positivo muda de banco pra banco — a BTG imprime compra positiva; o Itaú (lido
 * pelo parser genérico de PDF, sem sinal explícito na linha) sai negativo. Adivinhar um sinal
 * fixo fez uma fatura inteira do Itaú entrar como RENDA (133 compras viraram receita do mês).
 * A compra é sempre a maioria das linhas de uma fatura — então o sinal que aparece mais vezes é
 * a compra, e o minoritário é a exceção (estorno/pagamento/cancelamento).
 */
export function comprasDaFaturaSaoPositivas(parsed: Pick<ParsedTransaction, "amount">[]): boolean {
  return parsed.filter((t) => t.amount > 0).length >= parsed.filter((t) => t.amount < 0).length;
}
