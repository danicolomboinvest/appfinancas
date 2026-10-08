import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Porto Seguro (Porto Bank) em PDF.
 *
 *   Esta fatura vence em
 *   20/09/2026
 *   O valor total é
 *   R$ 638,61
 *   ...                                                  ← resumo, simulações de parcelamento
 *   Detalhamento
 *   Lançamentos: compras e saques
 *   Fulana (final *213)
 *   Data Estabelecimento Valor em R$
 *   15/03 LOJA EXEMPLO 405637 06/06 SAO PAUL 638,61      ← parcela desta fatura (compra de março)
 *   Lançamentos no cartão (final *213) 638,61            ← fim do cartão
 *
 * O leitor genérico pegava o vencimento com o valor total, o pagamento mínimo e o boleto como
 * compras: uma fatura de R$ 638 com uma compra só foi lida como R$ 1.947.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const VENCIMENTO_RE = /Esta fatura vence em\s*\n?\s*(\d{2})\/(\d{2})\/(\d{4})/i;

export function isPortoInvoice(texto: string): boolean {
  return /porto\s?seg|cartaoportoseguro/i.test(texto) && /^Data Estabelecimento Valor em R\$/im.test(texto) && /^Lan[çc]amentos no cart[ãa]o \(final/im.test(texto);
}

export function parsePortoInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[2]) : null;
  const anoVenc = venc ? Number(venc[3]) : refYear;
  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (/^Data Estabelecimento Valor em R\$/i.test(linha)) {
      dentro = true;
      continue;
    }
    if (/^Lan[çc]amentos no cart[ãa]o \(final/i.test(linha)) {
      dentro = false;
      continue;
    }
    if (!dentro) continue;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, menos, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (!(magnitude > 0)) continue;
    // Parcela traz a data da compra: mês depois do vencimento é do ano anterior.
    const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
    out.push({ date: `${ano}-${mm}-${dd}`, description: descricao, amount: menos ? -magnitude : magnitude });
  }
  return out;
}
