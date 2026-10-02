import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão de crédito Mercado Pago em PDF.
 *
 *   Vencimento: 14/09/2026
 *   Movimentações na fatura                         ← pagamento e créditos: tudo SEM sinal
 *   Data Movimentações Valor em R$
 *   14/08 Pagamento da fatura de agosto/2026 R$ 298,20
 *   31/08 Crédito concedido R$ 23,99
 *   Cartão Visa [************0000]                  ← daqui pra baixo, compras
 *   Data Movimentações Valor em R$
 *   20/03 MERCADOLIVRE*4PRODUTOS Parcela 6 de 6 R$ 17,08
 *   Total R$ 443,13
 *
 * O leitor genérico não tinha como saber que o "Crédito concedido" é devolução e a compra não é
 * (os dois vêm sem sinal), e pegava texto do rodapé como lançamento. Faltava também o total de
 * compras ("Consumos de 10/08 a 09/09") na conferência.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const VENCIMENTO_RE = /Vence(?:mento:|\s+em)\s*\n?\s*\d{2}\/(\d{2})\/(\d{4})/i;

export function isMercadoPagoInvoice(texto: string): boolean {
  return /mercado pago/i.test(texto) && /^Movimenta[çc][õo]es na fatura$/im.test(texto) && /^Data Movimenta[çc][õo]es Valor em R\$$/im.test(texto);
}

export function parseMercadoPagoInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[1]) : null;
  const anoVenc = venc ? Number(venc[2]) : refYear;
  const out: ParsedTransaction[] = [];
  let secao: "creditos" | "compras" | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (/^Movimenta[çc][õo]es na fatura$/i.test(linha)) secao = "creditos";
    else if (/^Cart[ãa]o\s+\S+.*\[[*\d]+\]$/i.test(linha)) secao = "compras";
    else if (/^Total\s+R\$/i.test(linha)) secao = null;
    if (!secao) continue;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, sinal, bruto] = m;
    const valor = parseBrazilianNumber(bruto);
    if (!valor) continue;
    const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
    // Compra positiva, crédito/pagamento negativo (como nos outros leitores de fatura).
    const credito = secao === "creditos" || sinal === "-";
    out.push({ date: `${ano}-${mm}-${dd}`, description: descricao, amount: credito ? -valor : valor });
  }
  return out;
}
