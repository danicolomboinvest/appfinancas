import type { ParsedTransaction } from "./statement-parser";
import { pareceEstorno } from "./estorno";

/**
 * Linhas de RESUMO da fatura de cartão: "pagamento efetuado/recebido/via conta" (o que o
 * cliente já pagou da fatura anterior) e "total de compras/créditos/pagamentos" (somatório que
 * a própria fatura já detalha item a item). Não são uma compra — importar essas linhas dobra o
 * gasto ou lança um "gasto" que na verdade é o pagamento da fatura.
 */
const FATURA_SUMMARY_RE =
  /\b(pagamentos?\s+(efetuado|recebido|realizado|de\s+fatura|via\s+conta|em\s+conta|d[eé]bito\s+autom[aá]tico)|pagamento\s+em\s+\d{1,2}\s+[a-z]{3}|d[eé]b(ito)?\.?\s+autom(\.|[aá]tico)?\s+de\s+fatura|pagto\.?\s+(por\s+)?d[eé]b(ito)?\.?\s+(em\s+)?c\/?c|total\s+de\s+(cr[eé]ditos?|compras|pagamentos?|despesas))\b/i;
/**
 * Outras redações do MESMO pagamento da fatura anterior, que cada banco escreve do seu jeito:
 * "Pagamento da fatura", "PAGAMENTO FATURA", "PAGTO FATURA", "Inclusao de Pagamento" (C6),
 * "PAGAMENTO ON LINE", "Pagto debito automatico", "PAGAMENTO DEB AUTOMATIC" (Itaú, cortado), "Pagamentos Validos Normais", "PGTO. CASH AG."
 * (Ourocard). Sem elas a linha passava como crédito, e na fatura todo crédito vira estorno: a fatura anterior inteira
 * (R$ 2.800) entrava como gasto NEGATIVO e o mês parecia ter gastado quase nada.
 */
const FATURA_PAGAMENTO_RE =
  /\b((pagamentos?|pagto|pgto)\.?\s+(d[aeo]\s+)?fatura|pagamentos?\s+on\s*-?\s*line|inclus[aã]o\s+de\s+pagamentos?|(pagamentos?|pagto|pgto)\.?\s+(por\s+)?d[eé]b(ito)?\.?\s+autom([aá]tic[oa]?)?|pagamentos?\s+v[aá]lidos|pgto\.?\s+cash)(?![a-z])/i;
/**
 * Linha do quadro "Limites" da fatura do Bradesco ("Compras  R$ 14.400,00  R$ 3.626,29
 * R$ 10.773,71"): a data do quadro vem na linha de cima, então o leitor achava que era uma compra
 * chamada "Compras" — e somava o limite DISPONÍVEL (R$ 10 mil) como gasto.
 */
const QUADRO_LIMITE_RE = /^(compras|saques?|saque\s+parcelado|compras\s+parceladas)$/i;

/** Testa a linha inteira (descrição E data) contra o padrão de resumo: faturas com várias
 * seções (pagamentos/créditos/compras) repetem o cabeçalho de coluna, e o subtotal entre
 * seções acaba caindo na coluna de data (ex.: BTG), não na de descrição. */
export function isFaturaSummaryLine(txn: ParsedTransaction): boolean {
  if (FATURA_SUMMARY_RE.test(txn.description) || FATURA_SUMMARY_RE.test(txn.date)) return true;
  if (FATURA_PAGAMENTO_RE.test(txn.description)) return true;
  if (QUADRO_LIMITE_RE.test(txn.description.trim())) return true;
  // "PAGAMENTO" sozinho, sem dizer de quê (Riachuelo/Midway): numa fatura é o da anterior.
  if (/^(\d{1,4}\s+)?pagamentos?$/i.test(txn.description.trim())) return true;
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

/**
 * Crédito da fatura que fala em PAGAMENTO e não diz que é devolução: quase sempre é o pagamento
 * da fatura anterior escrito de um jeito que `isFaturaSummaryLine` ainda não conhece. Como todo
 * crédito da fatura vira estorno, deixar passar descontava a fatura anterior inteira do mês.
 * Não some calado: a revisão mostra a linha em "fica de fora", com "Contar mesmo assim".
 */
export function pareceCreditoDePagamento(description: string): boolean {
  return /\b(pagamentos?|pagto|pgto)\b/i.test(description) && !pareceEstorno(description);
}
