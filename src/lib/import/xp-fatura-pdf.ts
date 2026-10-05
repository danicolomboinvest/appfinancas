import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão XP (Banco XP) em PDF.
 *
 *   Resumo da sua fatura Cartão XP Visa Infinite R$
 *   Total da fatura anterior 5.000,00
 *   Pagamentos/créditos até a emissão da fatura -5.000,00
 *   Despesas até a emissão desta fatura 1.234,56          ← o que as linhas somam
 *   PESSOA EXEMPLO - 4998********0000
 *   Data Descrição R$ US$
 *   26/02/26 LOJA EXEMPLO - Parcela 7/12 124,75 0,00       ← ano com 2 dígitos; R$ e depois US$
 *   06/09/26 SITE EXEMPLO.COM 229,00 44,91                 ← compra em dólar: vale o R$
 *   06/09/26 IOF Transacoes Exterior R$ 8,02
 *   02/09/26 Pagamentos Validos Normais -5.000,00          ← pagamento da anterior (resumo)
 *   24/09/26 Juros de Mora 1,94                            ← encargo: só a coluna R$
 *   Subtotal 1.234,56
 *
 * O leitor genérico não reconhecia a data com ano de 2 dígitos seguida de duas colunas de
 * valor e só achava o "Pagamento total" do boleto: cada fatura virava UM gasto (cliente subiu
 * 12 faturas e ficou com 12 linhas "Pagamento total").
 *
 * Compra sai POSITIVA; pagamento/crédito NEGATIVO.
 */

const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const LINHA_RE = new RegExp(String.raw`^(\d{2})\/(\d{2})\/(\d{2})\s+(.+?)\s+(${VALOR})(?:\s+${VALOR})?$`);

export function isXpInvoice(texto: string): boolean {
  return /Banco XP S\.A\./i.test(texto) && /Resumo da sua fatura\s+Cart[ãa]o XP/i.test(texto) && /Despesas at[ée] a emiss[ãa]o desta fatura/i.test(texto);
}

export function parseXpInvoice(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, aa, descricao, valor] = m;
    const negativo = valor.startsWith("-");
    const magnitude = parseBrazilianNumber(valor.replace(/^-/, ""));
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    // "IOF Transacoes Exterior R$ 8,02": o "R$" é o título da coluna, não parte do nome.
    const nome = descricao.replace(/\s+R\$$/, "").trim();
    out.push({ date: `20${aa}-${mm}-${dd}`, description: nome, amount: negativo ? -magnitude : magnitude });
  }
  return out;
}
