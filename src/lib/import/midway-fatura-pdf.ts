import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do Cartão Riachuelo (emitida pela Midway) em PDF.
 *
 *   Data Loja Descrição Valor original ... Nº parc. Lançamento do mês
 *   FULANA DE TAL 1234
 *   07/11/25 304 LOJA EXEMPLO 305,13 10/11 + 27,73     ← parcela 10 de 11 de uma compra de 305,13
 *   08/08/26 304 IFD*RESTAURANTE 56,39 + 56,39          ← compra à vista
 *   SUBTOTAL 735,86
 *   08/08/26 001 PAGAMENTO - 744,70                     ← pagamento da fatura anterior
 *   10/09/26 001 ANUIDADE RIACHUELO - TITULAR 04/12 + 15,99
 *
 * O leitor genérico pegava o PRIMEIRO valor da linha (o valor original da compra parcelada, não a
 * parcela do mês) e ignorava o sinal solto antes do valor: de 11 lançamentos lia 1. O que vale é o
 * último número, com o "+" (compra) ou "-" (pagamento/crédito) logo antes dele.
 */

const LINHA_RE =
  /^(\d{2})\/(\d{2})\/(\d{2})\s+\d{3}\s+(.+?)(?:\s+\d{1,3}(?:\.\d{3})*,\d{2})?(?:\s+(\d{2}\/\d{2}))?\s+([+-])\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;

export function isMidwayInvoice(texto: string): boolean {
  return /\bmidway\b/i.test(texto) && /Hist[óo]rico de Despesas/i.test(texto);
}

export function parseMidwayInvoice(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, aa, loja, parcela, sinal, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    // "PAGAMENTO" sozinho não diz de quê; é sempre o da fatura anterior.
    const nome = /^PAGAMENTO$/i.test(loja.trim()) ? "PAGAMENTO DE FATURA" : loja.trim();
    out.push({
      date: `20${aa}-${mm}-${dd}`,
      description: parcela ? `${nome} PARC ${parcela}` : nome,
      amount: sinal === "-" ? -magnitude : magnitude,
    });
  }
  return out;
}
