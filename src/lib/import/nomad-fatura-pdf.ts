import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão de crédito Nomad em PDF.
 *
 *   Resumo da sua fatura
 *   Despesas e créditos do mês R$ 3.140,41
 *   Extrato Referente ao mês de Setembro de 2026
 *   Data Descrição Valor
 *   29/08/2026 LOJA EXEMPLO CIDADE BR R$ 30,00
 *   11/09/2026 RESTAURANTE MIAMI FL (US$ 37,33 US$1.00 = R$ 5,3149) R$ 198,41   ← vale o último R$
 *   14/09/2026 IOF SOBRE TRANSACAO INTERNACIONAL R$ 6,94
 *   Data de vencimento
 *   05/10/2026
 *   Mês de referência: Setembro
 *   Valor da fatura                                     ← rodapé repetido em TODA página
 *   R$ 3.140,41
 *
 * O leitor genérico juntava a data de vencimento do rodapé com o "Valor da fatura" e lançava o
 * total da fatura como mais um gasto, uma vez por página: R$ 12.561 numa fatura de R$ 3.140. E o
 * arquivo era tratado como extrato.
 *
 * Compra sai POSITIVA; crédito/estorno ("-R$" ou "R$ -") NEGATIVO.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(-)?\s?R\$\s*(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})$/;

export function isNomadInvoice(texto: string): boolean {
  return /nomadglobal\.com|fatura Nomad/i.test(texto) && /Resumo da sua fatura/i.test(texto) && /Despesas e cr[ée]ditos do m[êe]s/i.test(texto);
}

export function parseNomadInvoice(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, aaaa, descricao, menosAntes, menosDepois, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    out.push({ date: `${aaaa}-${mm}-${dd}`, description: descricao.trim(), amount: menosAntes || menosDepois ? -magnitude : magnitude });
  }
  return out;
}
